import fs from 'node:fs/promises';
import { system } from './db';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface Storage {
  /** Short-lived URL the browser PUTs the raw upload to (size is signed into the URL where the provider allows). */
  presignPut(key: string, contentType: string, size: number): Promise<{ url: string; headers: Record<string, string> }>;
  head(key: string): Promise<{ size: number } | null>;
  get(key: string): Promise<Buffer>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<{ key: string; modified: Date }[]>;
}

// Everything the app stores lives under quarantine/ (raw, untrusted, purged hourly) or media/ (sanitized).
export const KEY_RE = /^(quarantine|media)\/[A-Za-z0-9][A-Za-z0-9/_.-]{0,200}$/;
const assertKey = (key: string) => {
  if (!KEY_RE.test(key) || key.includes('..') || key.includes('//')) throw new Error('bad storage key');
};

function fsStorage(): Storage {
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR || '.storage');
  const file = (key: string) => (assertKey(key), path.join(/*turbopackIgnore: true*/ root, ...key.split('/')));
  return {
    async presignPut(key, _ct, size) {
      assertKey(key);
      return { url: `/api/dev-upload?key=${encodeURIComponent(key)}&size=${size}`, headers: {} };
    },
    async head(key) {
      try { return { size: (await fs.stat(file(key))).size }; } catch { return null; }
    },
    get: (key) => fs.readFile(file(key)),
    async put(key, body) {
      await fs.mkdir(path.dirname(file(key)), { recursive: true });
      await fs.writeFile(file(key), body);
    },
    async delete(key) {
      await fs.rm(file(key), { force: true });
    },
    async list(prefix) {
      const out: { key: string; modified: Date }[] = [];
      const walk = async (dir: string) => {
        for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) await walk(p);
          else {
            const key = path.relative(root, p).split(path.sep).join('/');
            if (key.startsWith(prefix)) out.push({ key, modified: (await fs.stat(p)).mtime });
          }
        }
      };
      await walk(root);
      return out;
    },
  };
}

function s3Storage(): Storage {
  const Bucket = process.env.S3_BUCKET;
  if (!Bucket || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error('Storage is not configured: set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (and S3_ENDPOINT for R2/Supabase)');
  }
  const s3 = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
  });
  return {
    async presignPut(key, contentType, size) {
      assertKey(key);
      const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType, ContentLength: size }), {
        expiresIn: 600,
        signableHeaders: new Set(['content-type', 'content-length']),
      });
      return { url, headers: { 'Content-Type': contentType } };
    },
    async head(key) {
      try { return { size: (await s3.send(new HeadObjectCommand({ Bucket, Key: key }))).ContentLength ?? 0 }; } catch { return null; }
    },
    async get(key) {
      const r = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
      return Buffer.from(await r.Body!.transformToByteArray());
    },
    async put(key, body, contentType) {
      assertKey(key);
      await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async delete(key) {
      await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    async list(prefix) {
      const out: { key: string; modified: Date }[] = [];
      let token: string | undefined;
      do {
        const r = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }));
        for (const o of r.Contents ?? []) out.push({ key: o.Key!, modified: o.LastModified ?? new Date(0) });
        token = r.NextContinuationToken;
      } while (token);
      return out;
    },
  };
}

/**
 * DEMO ONLY (STORAGE_DRIVER=db, requires DEMO_MODE=1): keeps small files in Postgres so a demo deployment needs no
 * bucket. Uploads travel through a Vercel function, so they are capped near 4 MB. Real tip lines use private S3/R2.
 */
function dbStorage(): Storage {
  if (process.env.DEMO_MODE !== '1') throw new Error('STORAGE_DRIVER=db is for demos only (it needs DEMO_MODE=1). Use S3/R2 for real tips.');
  let ready: Promise<unknown> | undefined;
  const table = () =>
    (ready ??= system((q) => q('create table if not exists storage_objects (key text primary key, content bytea not null, content_type text, created_at timestamptz not null default now())')));
  return {
    async presignPut(key, _ct, size) {
      assertKey(key);
      return { url: `/api/dev-upload?key=${encodeURIComponent(key)}&size=${size}`, headers: {} };
    },
    async head(key) {
      await table();
      const r = await system((q) => q<{ n: string }>('select octet_length(content)::text as n from storage_objects where key = $1', [key]));
      return r[0] ? { size: Number(r[0].n) } : null;
    },
    async get(key) {
      await table();
      const r = await system((q) => q<{ content: Uint8Array }>('select content from storage_objects where key = $1', [key]));
      if (!r[0]) throw new Error('not found');
      return Buffer.from(r[0].content);
    },
    async put(key, body, contentType) {
      assertKey(key);
      await table();
      await system((q) => q('insert into storage_objects (key, content, content_type) values ($1, $2, $3) on conflict (key) do update set content = excluded.content, content_type = excluded.content_type, created_at = now()', [key, body, contentType]));
    },
    async delete(key) {
      await table();
      await system((q) => q('delete from storage_objects where key = $1', [key]));
    },
    async list(prefix) {
      await table();
      return (await system((q) => q<{ key: string; created_at: Date }>('select key, created_at from storage_objects where key like $1', [`${prefix.replace(/[%_\\]/g, '\\$&')}%`]))).map((r) => ({ key: r.key, modified: r.created_at }));
    },
  };
}

let cached: { driver: string; s: Storage } | undefined;
export function getStorage(): Storage {
  const d = process.env.STORAGE_DRIVER;
  const driver = d === 'fs' || d === 'db' ? d : 's3';
  if (cached?.driver !== driver) cached = { driver, s: driver === 'fs' ? fsStorage() : driver === 'db' ? dbStorage() : s3Storage() };
  return cached.s;
}
