'use server';
import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { resetDemo } from '@/lib/demo';
import { rateLimit } from '@/lib/ratelimit';
import { headerRequest } from '@/lib/session';
import { demoMode } from '@/lib/url';

/** Loads (or resets) the demo program. Needs the deployment's SETUP_TOKEN so strangers can't wipe a live demo. */
export async function loadDemoAction(_prev: { error?: string; ok?: string } | undefined, fd: FormData): Promise<{ error?: string; ok?: string }> {
  if (!demoMode()) return { error: 'Demo mode is not enabled on this deployment.' };
  if (rateLimit(await headerRequest(), 'demo-load', 6, 3_600_000)) return { error: 'Too many attempts. Try again later.' };
  const want = process.env.SETUP_TOKEN;
  if (!want) return { error: 'SETUP_TOKEN is not set on the server. Add it in Vercel → Settings → Environment Variables and redeploy.' };
  const got = Buffer.from(String(fd.get('setupToken') ?? ''));
  const exp = Buffer.from(want);
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) return { error: 'That setup token is not correct.' };
  try {
    const r = await resetDemo();
    revalidatePath('/', 'layout');
    return { ok: `Demo loaded: ${r.liveTips} hand-written tips and ${r.historicalTips} weeks-of-history tips.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not load the demo.' };
  }
}
