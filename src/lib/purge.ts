import { system } from './db';
import { getStorage } from './storage';

export type PurgeResult = { tips: number; objects: number; quarantine: number; orphans: number; sessions: number; audit: number };

const HOUR = 3_600_000;

/**
 * Enforces retention for every org: tips idle longer than retention_days are deleted (rows cascade to messages,
 * notes, media rows and push subscriptions) AFTER their files are removed from object storage. If a file cannot be
 * deleted the tip is kept and retried on the next run, so rows never outlive-or-orphan their evidence.
 * Also sweeps raw uploads in quarantine/, unreferenced media/ objects, expired sessions and old audit rows.
 *
 * Backups: database/provider backups are outside the app's reach. backup_retention_days is only what the org
 * DECLARES about its provider settings (shown in the privacy notice); see SECURITY.md for verifying it.
 */
export async function purge(now = new Date()): Promise<PurgeResult> {
  const storage = getStorage();
  const out: PurgeResult = { tips: 0, objects: 0, quarantine: 0, orphans: 0, sessions: 0, audit: 0 };

  const orgs = await system((q) => q<{ id: string; retention_days: number; audit_retention_days: number }>('select id, retention_days, audit_retention_days from organizations'));
  for (const org of orgs) {
    const expired = await system((q) =>
      q<{ id: string; keys: string[] }>(
        `select t.id, coalesce(array_agg(m.storage_key) filter (where m.id is not null), '{}') as keys
           from tips t left join media m on m.tip_id = t.id
          where t.org_id = $1 and t.updated_at < now() - make_interval(days => $2) group by t.id`,
        [org.id, org.retention_days],
      ),
    );
    const doomed: string[] = [];
    for (const t of expired) {
      let ok = true;
      for (const key of t.keys) {
        try { await storage.delete(key); out.objects++; } catch { ok = false; }
      }
      if (ok) doomed.push(t.id);
    }
    if (doomed.length) {
      await system((q) => q('delete from tips where id = any($1::uuid[])', [doomed]));
      out.tips += doomed.length;
    }
    out.audit += (await system((q) => q('delete from audit_log where org_id = $1 and created_at < now() - make_interval(days => $2) returning id', [org.id, org.audit_retention_days]))).length;
  }

  for (const o of await storage.list('quarantine/')) {
    if (now.getTime() - o.modified.getTime() > HOUR) { await storage.delete(o.key).catch(() => {}); out.quarantine++; }
  }

  const known = new Set((await system((q) => q<{ storage_key: string }>('select storage_key from media'))).map((r) => r.storage_key));
  for (const o of await storage.list('media/')) {
    if (!known.has(o.key) && now.getTime() - o.modified.getTime() > 24 * HOUR) { await storage.delete(o.key).catch(() => {}); out.orphans++; }
  }

  out.sessions = (await system((q) => q('delete from sessions where expires_at < now() returning token_hash'))).length;
  return out;
}
