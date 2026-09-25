// Sliding-window limiter held ONLY in process memory: the client IP is never written to a database, log or file.
// ponytail: per-instance on serverless (each warm lambda counts separately). Turnstile + the per-TIP-ID DB lockout
// carry the real weight; swap this Map for Upstash Redis if you need a hard global limit.
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** Returns a 429 Response when over the limit, otherwise null. */
export function rateLimit(req: Request, name: string, max: number, windowMs: number): Response | null {
  const now = Date.now();
  const key = `${name}|${clientIp(req)}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return Response.json(
      { error: 'Too many requests. Please wait a bit and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)), 'Cache-Control': 'no-store' } },
    );
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
  return null;
}

export const resetRateLimits = () => hits.clear();
