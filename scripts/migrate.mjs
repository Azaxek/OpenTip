// Applies db/migrations/*.sql in order. Safe to re-run. Used by `npm run migrate`, `vercel-build` and tests.
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

export async function runMigrations(connectionString, log = console.log) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())');
    const done = new Set((await client.query('select name from _migrations')).rows.map((r) => r.name));
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      if (done.has(file)) continue;
      log(`migrate: ${file}`);
      await client.query('begin');
      try {
        await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
        await client.query('insert into _migrations (name) values ($1)', [file]);
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw new Error(`Migration ${file} failed: ${e.message}`);
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const f of ['.env.local', '.env']) { try { process.loadEnvFile(f); } catch {} }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(1); }
  runMigrations(process.env.DATABASE_URL).then(() => console.log('migrate: up to date'), (e) => { console.error(e.message); process.exit(1); });
}
