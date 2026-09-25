import { hash, verify } from '@node-rs/argon2';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Passcodes, claim codes and staff passwords are only ever stored as argon2id hashes.
export const hashSecret = (plain: string) => hash(plain);

let dummy: Promise<string> | undefined;
/** Verifies even when there is no hash, so "no such TIP ID" costs the same time as "wrong passcode". */
export async function verifySecret(stored: string | null | undefined, plain: string): Promise<boolean> {
  try {
    const ok = await verify(stored ?? (await (dummy ??= hash('opentip-dummy'))), plain);
    return ok && !!stored;
  } catch {
    return false;
  }
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error('APP_SECRET must be set to 32+ characters (run: npm run keys)');
  return s;
}

/** Stateless HMAC-signed token. Tipster sessions use this so nothing about a tipster is written server-side. */
export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, e: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: unknown): (T & { e: number }) | null {
  if (typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const want = createHmac('sha256', secret()).update(body).digest();
  const got = Buffer.from(mac, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.e > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}
