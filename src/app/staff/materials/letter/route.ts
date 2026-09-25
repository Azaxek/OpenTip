import { fail } from '@/lib/http';
import { letterPdf } from '@/lib/materials';
import { getOrg } from '@/lib/org';
import { currentStaff } from '@/lib/session';

export async function POST(req: Request) {
  const s = await currentStaff();
  const org = await getOrg();
  if (!s || s.role !== 'admin' || !org) return fail('Unauthorized', 401);
  const body = String((await req.formData()).get('body') ?? '');
  return new Response(Buffer.from(await letterPdf(org, body)), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="parent-community-letter.pdf"' } });
}
