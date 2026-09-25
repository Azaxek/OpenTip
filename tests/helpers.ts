import { randomUUID } from 'node:crypto';
import { hashSecret } from '@/lib/crypto';
import { system } from '@/lib/db';
import type { Org } from '@/lib/org';
import { createOrganization } from '@/lib/setup';
import type { Staff } from '@/lib/staff';
import type { OrgType } from '@/lib/taxonomy';

export async function makeOrg(type: OrgType = 'campus', over: Partial<Org> = {}) {
  const { orgId, adminId } = await createOrganization(
    { name: `Test ${type} ${randomUUID().slice(0, 6)}`, orgType: type, hotline: '555-0100', maxRewardCents: 50000, adminName: 'Ada Admin', adminEmail: `admin-${randomUUID().slice(0, 6)}@example.org`, adminPassword: 'correct horse battery' },
    { allowMultiple: true },
  );
  for (const [k, v] of Object.entries(over)) await system((q) => q(`update organizations set ${k} = $1 where id = $2`, [v, orgId]));
  const org = (await system((q) => q<Org>('select * from organizations where id = $1', [orgId])))[0];
  const admin = (await system((q) => q<any>('select * from reviewers where id = $1', [adminId])))[0];
  return { org, admin: toStaff(admin), adminEmail: admin.email as string };
}

export const toStaff = (r: any): Staff => ({ id: r.id, orgId: r.org_id, email: r.email, name: r.name, role: r.role, allTips: r.all_tips, onCall: r.on_call });

/** A non-admin reviewer who is a member of the named teams. */
export async function makeReviewer(org: Org, teamNames: string[], opts: { onCall?: boolean; allTips?: boolean } = {}) {
  const hash = await hashSecret('reviewer-password-1');
  return system(async (q) => {
    const r = (
      await q<any>(
        "insert into reviewers (org_id, email, name, password_hash, role, all_tips, on_call) values ($1, $2, 'Rita Reviewer', $3, 'reviewer', $4, $5) returning *",
        [org.id, `rev-${randomUUID().slice(0, 6)}@example.org`, hash, !!opts.allTips, !!opts.onCall],
      )
    )[0];
    for (const t of teamNames) await q('insert into team_members (org_id, team_id, reviewer_id) select $1, id, $2 from teams where org_id = $1 and name = $3', [org.id, r.id, t]);
    return toStaff(r);
  });
}

export const categoryId = (org: Org, name: string) =>
  system(async (q) => (await q<{ id: string }>('select id from categories where org_id = $1 and name = $2', [org.id, name]))[0].id);

export const oneLocation = (org: Org) => system(async (q) => (await q<{ id: string }>('select id from locations where org_id = $1 limit 1', [org.id]))[0].id);
