import { fail, json, publicPost } from '@/lib/http';
import { getOrg } from '@/lib/org';
import { tipsterLogin } from '@/lib/tipster';

export async function POST(req: Request) {
  const r = await publicPost(req, 'tip-login', 60, 15 * 60_000, { maxBytes: 2_000 });
  if ('res' in r) return r.res;
  const org = await getOrg();
  if (!org) return fail('Not set up', 503);
  const token = await tipsterLogin(org, r.body.tipId, r.body.passcode);
  // One generic answer for wrong ID, wrong passcode and temporarily locked, so nothing leaks about which TIP IDs exist.
  return token ? json({ token }) : fail('That TIP ID and passcode do not match. After several wrong tries a tip is locked for 15 minutes.', 401);
}
