import { fail } from '@/lib/http';
import { getMediaFor } from '@/lib/queue';
import { currentStaff } from '@/lib/session';
import { getStorage } from '@/lib/storage';

/** Streams sanitized evidence to authorized staff only (team routing enforced), with Range support so video can seek. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await currentStaff();
  if (!s) return fail('Unauthorized', 401);
  const m = await getMediaFor(s, (await ctx.params).id);
  if (!m) return fail('Not found', 404);
  const data = await getStorage().get(m.storage_key);
  const headers: Record<string, string> = {
    'Content-Type': m.mime,
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Accept-Ranges': 'bytes',
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
    if (start > end || start >= data.length) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${data.length}` } });
    return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': String(end - start + 1) } });
  }
  return new Response(new Uint8Array(data), { headers: { ...headers, 'Content-Length': String(data.length) } });
}
