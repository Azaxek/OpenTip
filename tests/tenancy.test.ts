import { describe, expect, it } from 'vitest';
import { system, withOrg } from '@/lib/db';
import { listQueue, getTipDetail } from '@/lib/queue';
import { createTip } from '@/lib/tipster';
import { categoryId, makeOrg } from './helpers';

// Model B safety net: even if application code forgot a WHERE clause, Postgres RLS keeps orgs apart.
describe('cross-tenant isolation (Postgres RLS)', () => {
  it('an org can neither read, write, nor delete another org\'s rows in any tenant table', async () => {
    const A = await makeOrg('campus');
    const B = await makeOrg('campus');
    const tipB = await createTip(B.org, { categoryId: await categoryId(B.org, 'Weapons'), description: 'B-secret', passcode: 'pass-B-123' });
    await createTip(A.org, { categoryId: await categoryId(A.org, 'Weapons'), description: 'A-only', passcode: 'pass-A-123' });

    const tables = ['locations', 'categories', 'teams', 'category_teams', 'reviewers', 'team_members', 'sessions', 'tips', 'tip_teams', 'messages', 'internal_notes', 'media', 'push_subscriptions', 'canned_responses', 'audit_log', 'team_locations'];
    for (const t of tables) {
      const seenFromA = await withOrg(A.org.id, (q) => q<any>(`select org_id from ${t}`));
      expect(seenFromA.every((r) => r.org_id === A.org.id), `${t} leaked another org's rows`).toBe(true);
    }
    // explicitly asking for B's rows still returns nothing
    expect(await withOrg(A.org.id, (q) => q('select * from tips where org_id = $1', [B.org.id]))).toHaveLength(0);
    expect(await withOrg(A.org.id, (q) => q('select * from organizations where id = $1', [B.org.id]))).toHaveLength(0);
    expect(await withOrg(A.org.id, (q) => q('select * from tips where tip_id = $1', [tipB.tipId]))).toHaveLength(0);

    // writes are blocked, not just reads
    await expect(withOrg(A.org.id, (q) => q("insert into teams (org_id, name) values ($1, 'hijack')", [B.org.id]))).rejects.toThrow(/row-level security/);
    expect(await withOrg(A.org.id, (q) => q("update tips set description = 'pwned' where org_id = $1 returning id", [B.org.id]))).toHaveLength(0);
    expect(await withOrg(A.org.id, (q) => q('delete from tips where org_id = $1 returning id', [B.org.id]))).toHaveLength(0);
    expect((await system((q) => q<any>('select description from tips where tip_id = $1', [tipB.tipId])))[0].description).toBe('B-secret');
  });

  it('staff of one org cannot see or open another org\'s tips through the app layer either', async () => {
    const A = await makeOrg('crime_stoppers');
    const B = await makeOrg('crime_stoppers');
    await createTip(B.org, { categoryId: await categoryId(B.org, 'Fraud'), description: 'b', passcode: 'pass-B-123' });
    const bTipId = (await listQueue(B.admin))[0].id;
    expect(await listQueue(A.admin)).toHaveLength(0);
    expect(await getTipDetail(A.admin, bTipId)).toBeNull();
  });

  it('a connection with no org pinned sees nothing at all', async () => {
    await makeOrg('crime_stoppers');
    expect(await withOrg('00000000-0000-0000-0000-000000000000', (q) => q('select * from tips'))).toHaveLength(0);
    expect(await withOrg('00000000-0000-0000-0000-000000000000', (q) => q('select * from organizations'))).toHaveLength(0);
  });
});
