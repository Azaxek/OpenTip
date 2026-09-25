/** Cloudflare Turnstile. Deliberately does NOT forward the client IP (`remoteip`) to Cloudflare. */
export async function verifyTurnstile(token: unknown): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // No secret: allowed in development and in an explicit DEMO_MODE deployment; fails closed in real production.
  if (!secret) return process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1';
  if (typeof token !== 'string' || !token || token.length > 4096) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
    });
    return ((await r.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}
