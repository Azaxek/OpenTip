import { fail, json } from '@/lib/http';
import { listStaffMessages } from '@/lib/queue';
import { currentStaff } from '@/lib/session';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await currentStaff();
  if (!s) return fail('Unauthorized', 401);
  const { id } = await ctx.params;
  const since = Math.max(0, parseInt(new URL(req.url).searchParams.get('since') ?? '0', 10) || 0);
  const msgs = await listStaffMessages(s, id, since);
  return msgs ? json(msgs) : fail('Not found', 404);
}
