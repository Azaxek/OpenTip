import { audit } from './audit';
import { hashSecret, randomToken, sha256, verifySecret } from './crypto';
import { system, withOrg } from './db';

export type Staff = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: 'admin' | 'reviewer';
  allTips: boolean;
  onCall: boolean;
};

export const SESSION_DAYS = 7;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

/** Email + password login. Returns a session token (store as an httpOnly cookie) or null. Uniform failure either way. */
export async function staffLogin(orgId: string, email: string, password: string): Promise<string | null> {
  const row = (
    await withOrg(orgId, (q) =>
      q<{ id: string; password_hash: string; active: boolean; locked: boolean; name: string; email: string }>(
        'select id, password_hash, active, name, email, coalesce(locked_until > now(), false) as locked from reviewers where lower(email) = lower($1)',
        [String(email).slice(0, 320)],
      ),
    )
  )[0];
  const usable = row && row.active && !row.locked;
  const ok = await verifySecret(usable ? row.password_hash : null, String(password).slice(0, 256));
  if (!row) return null;
  if (!ok) {
    if (usable) {
      await withOrg(orgId, (q) =>
        q(
          `update reviewers set failed_attempts = failed_attempts + 1,
             locked_until = case when failed_attempts + 1 >= $2 then now() + make_interval(mins => $3) else locked_until end
           where id = $1`,
          [row.id, MAX_FAILS, LOCK_MINUTES],
        ),
      );
    }
    return null;
  }
  const token = randomToken();
  await withOrg(orgId, async (q) => {
    await q('update reviewers set failed_attempts = 0, locked_until = null where id = $1', [row.id]);
    await q("insert into sessions (token_hash, org_id, reviewer_id, expires_at) values ($1, $2, $3, now() + make_interval(days => $4))", [sha256(token), orgId, row.id, SESSION_DAYS]);
    await audit(q, { id: row.id, orgId, name: row.name, email: row.email }, 'auth.login');
  });
  return token;
}

/** Cross-org lookup by an unguessable token hash, so it runs as the owner role; everything after is org-scoped. */
export async function staffFromToken(token: string | undefined): Promise<Staff | null> {
  if (!token) return null;
  const r = (
    await system((q) =>
      q(
        `select r.id, r.org_id, r.email, r.name, r.role, r.all_tips, r.on_call
           from sessions s join reviewers r on r.id = s.reviewer_id
          where s.token_hash = $1 and s.expires_at > now() and r.active`,
        [sha256(token)],
      ),
    )
  )[0];
  return r ? { id: r.id, orgId: r.org_id, email: r.email, name: r.name, role: r.role, allTips: r.all_tips, onCall: r.on_call } : null;
}

export const staffLogout = (token: string) => system((q) => q('delete from sessions where token_hash = $1', [sha256(token)]));

export const newPasswordHash = (pw: string) => hashSecret(pw);

/** SQL predicate limiting which tips a staff member may touch: admins/all_tips see all, others only routed or assigned. */
export function visible(s: Staff, param: number, alias = 't'): string {
  if (s.role === 'admin' || s.allTips) return `($${param}::uuid is not null)`; // always true; keeps the parameter referenced
  return `(${alias}.assigned_reviewer_id = $${param} or exists (select 1 from tip_teams tt join team_members tm on tm.team_id = tt.team_id where tt.tip_id = ${alias}.id and tm.reviewer_id = $${param}))`;
}
