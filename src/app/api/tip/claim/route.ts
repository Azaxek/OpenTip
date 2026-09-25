import { fail, json, publicPost } from '@/lib/http';
import { revealClaimCode, tipsterFromRequest } from '@/lib/tipster';

/** Shows the reward claim code once. Rate-limited so the endpoint can't be hammered. */
export async function POST(req: Request) {
  const r = await publicPost(req, 'tip-claim', 10, 3_600_000, { turnstile: false, maxBytes: 1_000 });
  if ('res' in r) return r.res;
  const who = tipsterFromRequest(req);
  if (!who) return fail('Please sign in again.', 401);
  return json(await revealClaimCode(who.orgId, who.tipUuid));
}
