import { parse } from 'csv-parse/sync';
import { audit } from './audit';
import { withOrg } from './db';
import type { Staff } from './staff';

/**
 * SIS connector interface. A connector's ONLY job is to return the list of locations (schools/campuses).
 * Student rosters or any student-identifying data must never pass through here - and the CSV reference
 * implementation below rejects any file with columns beyond the two location fields.
 *
 * To write a connector for PowerSchool, Infinite Campus, etc.: implement `fetchLocations` against a read-only
 * "list of schools" API call, then hand it to `syncLocations` from a cron route or admin action.
 */
export interface LocationConnector {
  readonly name: string;
  fetchLocations(): Promise<{ externalId: string; name: string }[]>;
}

export class SisError extends Error {}

// Excel writes CRLF, editors write LF, and hand-edited files often mix them.
const LINE_ENDINGS = ['\r\n', '\n', '\r'];

/** Reference connector: a CSV with exactly the columns `external_id,name`. */
export function csvConnector(csv: string): LocationConnector {
  return {
    name: 'csv',
    async fetchLocations() {
      let rows: Record<string, string>[];
      try {
        rows = parse(csv, {
          columns: (h: string[]) => h.map((c) => c.trim().toLowerCase()),
          skip_empty_lines: true,
          trim: true,
          bom: true,
          record_delimiter: LINE_ENDINGS,
        });
      } catch {
        throw new SisError('Could not read that file as CSV.');
      }
      if (!rows.length) throw new SisError('The file has no rows.');
      const cols = Object.keys(rows[0]).sort().join(',');
      if (cols !== 'external_id,name') {
        throw new SisError('The CSV must have exactly two columns: external_id, name. Files with any other columns (for example student data) are rejected.');
      }
      if (rows.length > 5000) throw new SisError('Too many rows (5,000 max).');
      return rows.map((r) => {
        if (!r.external_id || !r.name || r.external_id.length > 100 || r.name.length > 200) throw new SisError('Every row needs an external_id (max 100 chars) and a name (max 200 chars).');
        return { externalId: r.external_id, name: r.name };
      });
    },
  };
}

/** Upserts by external_id; locations that disappear from the feed are deactivated (never deleted - tips reference them). */
export async function syncLocations(s: Staff, connector: LocationConnector) {
  if (s.role !== 'admin') throw new SisError('Admins only');
  const list = await connector.fetchLocations();
  return withOrg(s.orgId, async (q) => {
    let added = 0;
    let updated = 0;
    for (const l of list) {
      const r = await q<{ inserted: boolean }>(
        `insert into locations (org_id, name, external_id) values ($1, $2, $3)
         on conflict (org_id, external_id) where external_id is not null do update set name = excluded.name, active = true
         returning (xmax = 0) as inserted`,
        [s.orgId, l.name, l.externalId],
      );
      r[0].inserted ? added++ : updated++;
    }
    const gone = await q('update locations set active = false where external_id is not null and active and not (external_id = any($1::text[])) returning id', [list.map((l) => l.externalId)]);
    await audit(q, s, 'sis.sync', null, { connector: connector.name, added, updated, deactivated: gone.length });
    return { added, updated, deactivated: gone.length };
  });
}
