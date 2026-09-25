import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_DAYS, staffFromToken, type Staff } from './staff';

const COOKIE = 'ot_staff';

export async function currentStaff(): Promise<Staff | null> {
  return staffFromToken((await cookies()).get(COOKIE)?.value);
}

export async function requireStaff(): Promise<Staff> {
  const s = await currentStaff();
  if (!s) redirect('/staff/login');
  return s;
}

export async function requireAdmin(): Promise<Staff> {
  const s = await requireStaff();
  if (s.role !== 'admin') redirect('/staff');
  return s;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400 });
}

export const clearSessionCookie = async () => (await cookies()).delete(COOKIE);
export const sessionCookieValue = async () => (await cookies()).get(COOKIE)?.value;

/** A Request carrying the current headers, so the shared rate limiter can be used from server actions. */
export async function headerRequest(): Promise<Request> {
  return new Request('http://localhost', { headers: await headers() });
}
