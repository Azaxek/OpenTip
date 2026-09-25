import { fail, json } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';
import { getStorage } from '@/lib/storage';

/**
 * Stand-in for a presigned storage URL. Only exists for local development (STORAGE_DRIVER=fs) and for demo
 * deployments (STORAGE_DRIVER=db with DEMO_MODE=1). Real deployments upload straight to private S3/R2 instead.
 */
export async function PUT(req: Request) {
  const dev = process.env.STORAGE_DRIVER === 'fs' && process.env.NODE_ENV !== 'production';
  const demo = process.env.STORAGE_DRIVER === 'db' && process.env.DEMO_MODE === '1';
  if (!dev && !demo) return fail('Not found', 404);
  const limited = rateLimit(req, 'dev-upload', 40, 3_600_000);
  if (limited) return limited;
  const url = new URL(req.url);
  const key = url.searchParams.get('key') ?? '';
  const size = Number(url.searchParams.get('size'));
  if (!key.startsWith('quarantine/') || !Number.isInteger(size) || size <= 0 || size > 4_500_000) return fail('Bad upload');
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length !== size) return fail('Bad upload');
  await getStorage().put(key, body, req.headers.get('content-type') ?? 'application/octet-stream');
  return json({ ok: true });
}
