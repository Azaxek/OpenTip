import { fail, json, publicPost } from '@/lib/http';
import { removeSubscription, saveSubscription, validSubscription } from '@/lib/push';
import { getTipStatus, tipsterFromRequest } from '@/lib/tipster';

export async function POST(req: Request) {
  const r = await publicPost(req, 'tip-push', 10, 3_600_000, { turnstile: false, maxBytes: 4_000 });
  if ('res' in r) return r.res;
  const who = tipsterFromRequest(req);
  if (!who) return fail('Please sign in again.', 401);
  if (!(await getTipStatus(who.orgId, who.tipUuid))) return fail('Please sign in again.', 401);
  if (!validSubscription(r.body.subscription)) return fail('Unsupported notification address.');
  await saveSubscription(who.orgId, who.tipUuid, r.body.subscription);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const r = await publicPost(req, 'tip-push', 10, 3_600_000, { turnstile: false, maxBytes: 4_000 });
  if ('res' in r) return r.res;
  const who = tipsterFromRequest(req);
  if (!who) return fail('Please sign in again.', 401);
  if (typeof r.body.endpoint === 'string') await removeSubscription(who.orgId, who.tipUuid, r.body.endpoint);
  return json({ ok: true });
}
