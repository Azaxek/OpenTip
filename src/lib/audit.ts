import type { Q } from './db';
import type { Staff } from './staff';

/**
 * Append-only trail of STAFF actions. Records who (staff) did what to which TIP ID - never anything about a tipster.
 * Call inside the same transaction as the action so the two commit or roll back together.
 */
export async function audit(q: Q, s: Pick<Staff, 'id' | 'orgId' | 'name' | 'email'>, action: string, tipRef: string | null = null, detail: object | null = null) {
  await q('insert into audit_log (org_id, reviewer_id, actor, action, tip_ref, detail) values ($1, $2, $3, $4, $5, $6)', [
    s.orgId,
    s.id,
    `${s.name} <${s.email}>`,
    action,
    tipRef,
    detail ? JSON.stringify(detail) : null,
  ]);
}
