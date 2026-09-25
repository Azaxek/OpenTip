'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { escalate } from '@/lib/escalation';
import { getOrg } from '@/lib/org';
import {
  StaffInputError, addNote, assignTip, closeTip, redeemClaim, reissueClaimCode, sendReviewerMessage, setReward, setStatus, setTipTeams, setUrgent,
} from '@/lib/queue';
import { rateLimit } from '@/lib/ratelimit';
import { clearSessionCookie, headerRequest, requireStaff, sessionCookieValue, setSessionCookie } from '@/lib/session';
import { staffLogin, staffLogout, type Staff } from '@/lib/staff';
import { verifyTurnstile } from '@/lib/turnstile';

export async function loginAction(email: string, password: string, turnstileToken: string): Promise<{ error?: string }> {
  if (rateLimit(await headerRequest(), 'staff-login', 10, 15 * 60_000)) return { error: 'Too many attempts. Please wait 15 minutes.' };
  if (!(await verifyTurnstile(turnstileToken))) return { error: 'Bot check failed. Reload the page and try again.' };
  const org = await getOrg();
  if (!org) redirect('/setup');
  const token = await staffLogin(org.id, email, password);
  if (!token) return { error: 'Wrong email or password. Accounts lock for 15 minutes after 5 wrong tries.' };
  await setSessionCookie(token);
  redirect('/staff');
}

export async function logoutAction() {
  const t = await sessionCookieValue();
  if (t) await staffLogout(t);
  await clearSessionCookie();
  redirect('/staff/login');
}

/** Runs a staff mutation, then refreshes the page; a validation problem comes back as a ?e= banner instead of a crash. */
async function run(back: string, fn: (s: Staff) => Promise<unknown>) {
  const s = await requireStaff();
  let err = '';
  try {
    await fn(s);
  } catch (e) {
    if (e instanceof StaffInputError) err = e.message;
    else throw e;
  }
  revalidatePath(back);
  if (err) redirect(`${back}?e=${encodeURIComponent(err)}`);
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');
const tipPath = (fd: FormData) => `/staff/tips/${str(fd, 'tipId')}`;

export async function sendMessageAction(tipId: string, body: string): Promise<{ error?: string }> {
  const s = await requireStaff();
  try {
    await sendReviewerMessage(s, tipId, body);
    return {};
  } catch (e) {
    if (e instanceof StaffInputError) return { error: e.message };
    throw e;
  }
}

export const noteAction = async (fd: FormData) => run(tipPath(fd), (s) => addNote(s, str(fd, 'tipId'), str(fd, 'body')));
export const statusAction = async (fd: FormData) => run(tipPath(fd), (s) => setStatus(s, str(fd, 'tipId'), str(fd, 'status') as 'under_review' | 'actioned'));
export const closeAction = async (fd: FormData) => run(tipPath(fd), (s) => closeTip(s, str(fd, 'tipId'), str(fd, 'reason'), str(fd, 'note')));
export const urgentAction = async (fd: FormData) => run(tipPath(fd), (s) => setUrgent(s, str(fd, 'tipId'), str(fd, 'urgent') === '1'));
export const assignAction = async (fd: FormData) => run(tipPath(fd), (s) => assignTip(s, str(fd, 'tipId'), str(fd, 'reviewerId') || null));
export const routeAction = async (fd: FormData) => run(tipPath(fd), (s) => setTipTeams(s, str(fd, 'tipId'), fd.getAll('teamId').map(String)));
export const rewardAction = async (fd: FormData) =>
  run(tipPath(fd), (s) => setReward(s, str(fd, 'tipId'), str(fd, 'eligible') === '1', Math.round(Number(str(fd, 'amount') || 0) * 100)));
export const reissueAction = async (fd: FormData) => run(tipPath(fd), (s) => reissueClaimCode(s, str(fd, 'tipId')));

export async function escalateAction(fd: FormData) {
  const s = await requireStaff();
  const id = str(fd, 'tipId');
  let qs: string;
  try {
    const r = await escalate(s, id);
    qs = r.email === 'simulated' ? `?esc=sim&n=${r.recipients}` : r.delivered ? '?esc=ok' : `?esc=fail&em=${r.email}&wh=${r.webhook}`;
  } catch (e) {
    if (!(e instanceof StaffInputError)) throw e;
    qs = `?e=${encodeURIComponent(e.message)}`;
  }
  redirect(`/staff/tips/${id}${qs}`);
}

export async function redeemAction(fd: FormData) {
  const s = await requireStaff();
  const r = await redeemClaim(s, str(fd, 'tipId'), str(fd, 'code'));
  revalidatePath('/staff/rewards');
  redirect(`/staff/rewards?${r.ok ? 'ok' : 'e'}=${encodeURIComponent(r.message)}`);
}
