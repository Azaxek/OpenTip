import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { system } from '@/lib/db';
import { purge } from '@/lib/purge';
import { getStorage } from '@/lib/storage';
import { createTip } from '@/lib/tipster';
import { categoryId, makeOrg } from './helpers';

const storage = () => getStorage();
const ageFile = async (key: string, hoursAgo: number) => {
  const p = path.join(process.env.STORAGE_DIR!, ...key.split('/'));
  const t = new Date(Date.now() - hoursAgo * 3_600_000);
  await fs.utimes(p, t, t);
};

async function tipWithEvidence(org: any, description: string) {
  const t = await createTip(org, { categoryId: await categoryId(org, 'Fraud'), description, passcode: 'hunter22' });
  const row = (await system((q) => q<any>('select id from tips where tip_id = $1', [t.tipId])))[0];
  const key = `media/${org.id}/${row.id}/file-${Math.random().toString(36).slice(2)}.jpg`;
  await storage().put(key, Buffer.from('fake-image-bytes'), 'image/jpeg');
  await system(async (q) => {
    await q("insert into media (org_id, tip_id, kind, mime, size_bytes, storage_key) values ($1, $2, 'image', 'image/jpeg', 16, $3)", [org.id, row.id, key]);
    await q("insert into messages (org_id, tip_id, sender, body) values ($1, $2, 'tipster', 'hello')", [org.id, row.id]);
    await q("insert into push_subscriptions (org_id, tip_id, subscription) values ($1, $2, '{\"endpoint\":\"https://fcm.googleapis.com/x\",\"keys\":{\"p256dh\":\"a\",\"auth\":\"b\"}}')", [org.id, row.id]);
  });
  return { id: row.id as string, key };
}

describe('retention purge', () => {
  it('deletes idle tips AND their files, messages and push subscriptions; keeps recent ones', async () => {
    const { org } = await makeOrg('crime_stoppers', { retention_days: 30 });
    const old = await tipWithEvidence(org, 'old');
    const fresh = await tipWithEvidence(org, 'fresh');
    await system((q) => q("update tips set updated_at = now() - interval '45 days' where id = $1", [old.id]));

    const r = await purge();
    expect(r.tips).toBeGreaterThanOrEqual(1);

    // gone from the database (cascade) ...
    for (const t of ['tips', 'messages', 'media', 'push_subscriptions']) {
      const col = t === 'tips' ? 'id' : 'tip_id';
      expect(await system((q) => q(`select 1 from ${t} where ${col} = $1`, [old.id])), t).toHaveLength(0);
    }
    // ... and from object storage
    expect(await storage().head(old.key)).toBeNull();
    // recent tip untouched
    expect(await storage().head(fresh.key)).not.toBeNull();
    expect(await system((q) => q('select 1 from tips where id = $1', [fresh.id]))).toHaveLength(1);
  });

  it('keeps a tip (and retries next run) if its file cannot be deleted, so evidence is never orphaned', async () => {
    const { org } = await makeOrg('crime_stoppers', { retention_days: 30 });
    const t = await tipWithEvidence(org, 'stuck');
    await system((q) => q("update tips set updated_at = now() - interval '45 days' where id = $1", [t.id]));
    const spy = vi.spyOn(storage(), 'delete').mockRejectedValueOnce(new Error('storage down'));
    await purge();
    expect(await system((q) => q('select 1 from tips where id = $1', [t.id]))).toHaveLength(1);
    expect(await storage().head(t.key)).not.toBeNull();
    spy.mockRestore();
    await purge(); // storage back: now it goes
    expect(await system((q) => q('select 1 from tips where id = $1', [t.id]))).toHaveLength(0);
    expect(await storage().head(t.key)).toBeNull();
  });

  it('sweeps stale raw uploads (quarantine), unreferenced media objects, expired sessions and old audit rows', async () => {
    const { org, admin } = await makeOrg('crime_stoppers');
    await storage().put('quarantine/stale-upload', Buffer.from('raw'), 'image/jpeg');
    await storage().put('quarantine/fresh-upload', Buffer.from('raw'), 'image/jpeg');
    await storage().put(`media/${org.id}/orphan/orphan.jpg`, Buffer.from('x'), 'image/jpeg');
    await ageFile('quarantine/stale-upload', 2);
    await ageFile('quarantine/fresh-upload', 0);
    await ageFile(`media/${org.id}/orphan/orphan.jpg`, 48);
    await system(async (q) => {
      await q("insert into sessions (token_hash, org_id, reviewer_id, expires_at) values ('expired-token-hash', $1, $2, now() - interval '1 day')", [org.id, admin.id]);
      await q("insert into audit_log (org_id, reviewer_id, actor, action, created_at) values ($1, $2, 'x', 'tip.view', now() - interval '5000 days')", [org.id, admin.id]);
    });

    const r = await purge();
    expect(r.quarantine).toBeGreaterThanOrEqual(1);
    expect(await storage().head('quarantine/stale-upload')).toBeNull();
    expect(await storage().head('quarantine/fresh-upload')).not.toBeNull();
    expect(await storage().head(`media/${org.id}/orphan/orphan.jpg`)).toBeNull();
    expect(await system((q) => q("select 1 from sessions where token_hash = 'expired-token-hash'"))).toHaveLength(0);
    expect(await system((q) => q("select 1 from audit_log where created_at < now() - interval '4000 days'"))).toHaveLength(0);
  });

  it('retention is per-organization', async () => {
    const short = await makeOrg('crime_stoppers', { retention_days: 7 });
    const long = await makeOrg('crime_stoppers', { retention_days: 400 });
    const a = await tipWithEvidence(short.org, 'a');
    const b = await tipWithEvidence(long.org, 'b');
    await system((q) => q("update tips set updated_at = now() - interval '30 days' where id = any($1::uuid[])", [[a.id, b.id]]));
    await purge();
    expect(await system((q) => q('select 1 from tips where id = $1', [a.id]))).toHaveLength(0);
    expect(await system((q) => q('select 1 from tips where id = $1', [b.id]))).toHaveLength(1);
  });
});
