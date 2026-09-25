import Link from 'next/link';
import { Flash, StatusBadge, UrgentBadge, ago } from '@/components/staff/ui';
import { withOrg } from '@/lib/db';
import { listQueue, type QueueFilter } from '@/lib/queue';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Queue' };

type SP = Record<string, string | undefined>;

export default async function Queue({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const f: QueueFilter = {
    status: sp.status, categoryId: sp.category, locationId: sp.location, teamId: sp.team, assignee: sp.assignee,
    urgent: sp.urgent === '1', sort: (['newest', 'oldest'] as const).find((x) => x === sp.sort) ?? 'priority',
  };
  const tips = await listQueue(s, f);
  const opts = await withOrg(s.orgId, async (q) => ({
    categories: await q<{ id: string; name: string }>('select id, name from categories order by sort, name'),
    locations: await q<{ id: string; name: string }>('select id, name from locations order by name'),
    teams: await q<{ id: string; name: string }>('select id, name from teams order by name'),
    reviewers: await q<{ id: string; name: string }>('select id, name from reviewers where active order by name'),
  }));
  const sel = 'input !py-1.5 text-sm';
  return (
    <div className="space-y-4">
      <Flash e={sp.e} />
      <form method="get" className="card grid grid-cols-2 items-end gap-3 md:grid-cols-4 lg:grid-cols-8">
        <label className="text-xs font-semibold">Status
          <select name="status" defaultValue={sp.status ?? 'open'} className={sel}>
            <option value="open">Open</option><option value="all">All</option>
            <option value="new">New</option><option value="under_review">Under review</option><option value="actioned">Actioned</option><option value="closed">Closed</option>
          </select>
        </label>
        <label className="text-xs font-semibold">Category
          <select name="category" defaultValue={sp.category ?? ''} className={sel}><option value="">Any</option>{opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="text-xs font-semibold">Location
          <select name="location" defaultValue={sp.location ?? ''} className={sel}><option value="">Any</option>{opts.locations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="text-xs font-semibold">Team
          <select name="team" defaultValue={sp.team ?? ''} className={sel}><option value="">Any</option>{opts.teams.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="text-xs font-semibold">Assigned to
          <select name="assignee" defaultValue={sp.assignee ?? ''} className={sel}>
            <option value="">Anyone</option><option value="me">Me</option><option value="unassigned">Unassigned</option>
            {opts.reviewers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">Sort
          <select name="sort" defaultValue={f.sort} className={sel}><option value="priority">Urgent first</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-xs font-semibold"><input type="checkbox" name="urgent" value="1" defaultChecked={f.urgent} className="size-4" /> Urgent / high-risk only</label>
        <button className="btn btn-primary !min-h-9">Filter</button>
      </form>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
            <tr><th className="p-3">Tip</th><th className="p-3">Category</th><th className="p-3">Location</th><th className="p-3">Teams</th><th className="p-3">Assigned</th><th className="p-3">Status</th><th className="p-3">Received</th></tr>
          </thead>
          <tbody>
            {tips.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-600">No tips match. Nice and quiet.</td></tr>}
            {tips.map((t: any) => (
              <tr key={t.id} className={`border-b border-slate-100 hover:bg-slate-50 ${t.priority && t.status !== 'closed' ? 'bg-red-50/60' : ''}`}>
                <td className="p-3">
                  <Link href={`/staff/tips/${t.id}`} className="link font-mono">{t.tip_id}</Link>
                  <span className="ml-2 inline-flex gap-1 align-middle">
                    {t.priority && t.status !== 'closed' && <UrgentBadge />}
                    {t.needs_reply && t.status !== 'closed' && <span className="badge bg-indigo-100 text-indigo-900">Awaiting reply</span>}
                  </span>
                </td>
                <td className="p-3">{t.category}</td>
                <td className="p-3">{t.location ?? '—'}</td>
                <td className="p-3">{t.teams ?? '—'}</td>
                <td className="p-3">{t.assignee ?? '—'}</td>
                <td className="p-3"><StatusBadge status={t.status} /></td>
                <td className="p-3 whitespace-nowrap">{ago(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">You see tips routed to your teams or assigned to you{s.role === 'admin' || s.allTips ? ' — and all tips, because you have broader access' : ''}.</p>
    </div>
  );
}
