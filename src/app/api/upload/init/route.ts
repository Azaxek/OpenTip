import { fail, json, publicPost } from '@/lib/http';
import { getOrg } from '@/lib/org';
import { planUploads } from '@/lib/uploads';

export async function POST(req: Request) {
  const r = await publicPost(req, 'upload-init', 120, 3_600_000);
  if ('res' in r) return r.res;
  const org = await getOrg();
  if (!org) return fail('Not set up', 503);
  const plan = await planUploads(org, r.body.files);
  return 'error' in plan ? fail(plan.error) : json(plan);
}
