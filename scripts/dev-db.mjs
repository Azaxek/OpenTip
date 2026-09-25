// Zero-setup local Postgres (PGlite over TCP) so `npm run dev:db && npm run dev` works with no accounts.
// Data persists in ./.pglite. NOT for production - use Neon or Supabase there.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { runMigrations } from './migrate.mjs';

const port = Number(process.env.DEV_DB_PORT || 5433);
const db = await PGlite.create('./.pglite');
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
await server.start();
const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
await runMigrations(url);
console.log(`\nLocal dev database ready. Put this in .env.local:\nDATABASE_URL=${url}\nPG_POOL_MAX=1\nPG_SIMPLE_PROTOCOL=1\n`);
process.on('SIGINT', async () => { await server.stop(); await db.close(); process.exit(0); });
