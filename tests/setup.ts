import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll } from 'vitest';
import { closePool } from '@/lib/db';

process.env.APP_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.APP_URL = 'http://localhost:3000';
process.env.STORAGE_DRIVER = 'fs';
process.env.STORAGE_DIR = path.join(os.tmpdir(), `opentip-test-${process.pid}`);

// Every test file gets its own in-memory Postgres (PGlite, real Postgres compiled to WASM) with the real migrations
// applied. It is plugged in where the `pg` Pool normally lives, so all app code runs unchanged, using the extended
// protocol with real bind parameters (same semantics as Neon/Supabase).
const db = await PGlite.create();
const dir = path.resolve(process.cwd(), 'db/migrations');
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));

let busy: Promise<void> = Promise.resolve(); // one connection at a time, like PG_POOL_MAX=1
(globalThis as any).__otPool = {
  async connect() {
    let release!: () => void;
    const turn = busy;
    busy = new Promise<void>((r) => (release = r));
    await turn;
    return { query: async (text: string, params?: unknown[]) => ({ rows: (await db.query(text, params as any[])).rows }), release };
  },
  on() {},
  async end() {},
};

afterAll(async () => {
  await closePool();
  await db.close();
  fs.rmSync(process.env.STORAGE_DIR!, { recursive: true, force: true });
});
