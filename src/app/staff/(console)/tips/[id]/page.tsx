import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChatPanel } from '@/components/staff/ChatPanel';
import { Card, Flash, StatusBadge, UrgentBadge, when } from '@/components/staff/ui';
import { withOrg } from '@/lib/db';
import { getTipDetail } from '@/lib/queue';
import { requireStaff } from '@/lib/session';
import { assignAction, closeAction, escalateAction, noteAction, reissueAction, rewardAction, routeAction, statusAction, urgentAction } from '../../../actions';

export const metadata = { title: 'Tip' };

const CH: Record<string, string> = { sent: 'sent', failed: 'FAILED', not_configured: 'not configured', no_recipients: 'no recipients' };

export default async function TipPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const d = await getTipDetail(s, id);
  if (!d) notFound();
  const { tip, media, notes, teams, tipTeamIds, reviewers, canned } = d;
  const maxReward = (await withOrg(s.orgId, (q) => q<{ max_reward_cents: number }>('select max_reward_cents from organizations')))[0].max_reward_cents;
  const priority = tip.urgent || tip.high_risk;
  const closed = tip.status === 'closed';
  const hidden = <input type="hidden" name="tipId" value={id} />;

  return (
    <div className="space-y-4">
      <Link href="/staff" className="link text-sm">← Queue</Link>
      <Flash e={sp.e} />
      {sp.esc === 'ok' && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-900">Escalation sent to your configured channels and logged.</p>}
      {sp.esc === 'sim' && (
        <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-900">
          Demo mode: escalation was recorded in the audit log and the alert was <em>simulated</em>. In a live system it goes at once to the {sp.n ?? 'on-call'} on-call staff by email and to your Slack/Discord channel, and this page tells you which channels actually delivered.
        </p>
      )}
      {sp.esc === 'fail' && (
        <p role="alert" className="rounded-lg border-2 border-red-800 bg-red-50 p-3 text-sm font-bold text-red-900">
          Escalation was logged but NO alert was delivered (email: {CH[sp.em ?? ''] ?? sp.em}; webhook: {CH[sp.wh ?? ''] ?? sp.wh}). Contact your on-call person directly now. Check Settings → escalation.
        </p>
      )}

      <div className="card flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold">{tip.tip_id}</h1>
        <StatusBadge status={tip.status} />
        {priority && !closed && <UrgentBadge />}
        <span className="text-sm text-slate-600">{tip.category}{tip.location ? ` · ${tip.location}` : ''} · received {when(tip.created_at)}</span>
        {priority && !closed && (
          <form action={escalateAction} className="ml-auto">{hidden}<button className="btn btn-danger">Escalate now</button></form>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Description">
            {tip.description ? <p className="whitespace-pre-wrap">{tip.description}</p> : <p className="text-slate-600">No written description (evidence only).</p>}
          </Card>

          {media.length > 0 && (
            <Card title={`Evidence (${media.length})`}>
              <p className="mb-3 text-xs text-slate-600">Metadata was stripped from every file on upload.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {media.map((m: any) => (
                  <figure key={m.id} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {m.kind === 'image' && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/staff/media/${m.id}`} alt="Evidence photo" className="max-h-72 w-full object-contain" loading="lazy" />}
                    {m.kind === 'video' && <video src={`/staff/media/${m.id}`} controls preload="metadata" className="max-h-72 w-full" />}
                    {m.kind === 'audio' && <audio src={`/staff/media/${m.id}`} controls preload="metadata" className="w-full" />}
                    {m.kind === 'document' && <iframe src={`/staff/media/${m.id}`} title="PDF preview" className="h-72 w-full" />}
                    <figcaption className="mt-1 flex justify-between text-xs text-slate-600"><span>{m.mime} · {m.size_bytes < 1048576 ? `${Math.max(1, Math.round(m.size_bytes / 1024))} KB` : `${(m.size_bytes / 1048576).toFixed(1)} MB`}</span><a className="link" href={`/staff/media/${m.id}`} target="_blank" rel="noreferrer">Open</a></figcaption>
                  </figure>
                ))}
              </div>
            </Card>
          )}

          <Card title="Anonymous chat"><ChatPanel tipId={id} canned={canned} closed={closed} /></Card>
        </div>

        <div className="space-y-4">
          <Card title="Status">
            <div className="flex flex-wrap gap-2">
              {(['under_review', 'actioned'] as const).map((st) => (
                <form key={st} action={statusAction}>{hidden}<input type="hidden" name="status" value={st} /><button className="btn !min-h-9 text-xs" disabled={tip.status === st}>{st === 'under_review' ? 'Under review' : 'Actioned'}</button></form>
              ))}
              <form action={urgentAction}>{hidden}<input type="hidden" name="urgent" value={tip.urgent ? '0' : '1'} /><button className="btn !min-h-9 text-xs">{tip.urgent ? 'Remove urgent flag' : 'Flag urgent'}</button></form>
            </div>
            <form action={closeAction} className="mt-4 space-y-2 border-t border-slate-200 pt-3">
              {hidden}
              <label className="label" htmlFor="reason">Close this tip</label>
              <select id="reason" name="reason" required defaultValue={tip.closure_reason ?? ''} className="input !py-1.5 text-sm">
                <option value="" disabled>Closure reason (required)…</option>
                <option value="actioned">Actioned</option><option value="unfounded">Unfounded</option><option value="referred">Referred</option><option value="other">Other</option>
              </select>
              <textarea name="note" className="input text-sm" placeholder="Optional closure note" maxLength={2000} defaultValue={tip.closure_note ?? ''} />
              <button className="btn !min-h-9 text-xs">{closed ? 'Update closure' : 'Close tip'}</button>
            </form>
          </Card>

          <Card title="Assignment & routing">
            <form action={assignAction} className="flex gap-2">
              {hidden}
              <select name="reviewerId" defaultValue={tip.assigned_reviewer_id ?? ''} className="input !py-1.5 text-sm" aria-label="Assigned reviewer">
                <option value="">Unassigned</option>
                {reviewers.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button className="btn !min-h-9 text-xs">Assign</button>
            </form>
            <form action={routeAction} className="mt-3 space-y-1 border-t border-slate-200 pt-3">
              {hidden}
              <p className="label">Teams that see this tip</p>
              {teams.map((t: any) => <label key={t.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="teamId" value={t.id} defaultChecked={tipTeamIds.includes(t.id)} className="size-4" />{t.name}</label>)}
              <button className="btn !min-h-9 text-xs">Save routing</button>
              <p className="hint">Tips with no team are visible only to admins and staff with all-tips access.</p>
            </form>
          </Card>

          <Card title="Reward">
            {tip.claimed_at ? (
              <p className="text-sm">Claimed {when(tip.claimed_at)} · ${((tip.reward_amount_cents ?? 0) / 100).toFixed(2)}</p>
            ) : (
              <>
                <form action={rewardAction} className="space-y-2">
                  {hidden}
                  <input type="hidden" name="eligible" value="1" />
                  <label className="label" htmlFor="amount">{tip.reward_eligible ? 'Reward amount (USD)' : 'Mark reward-eligible: amount (USD)'}</label>
                  <input id="amount" name="amount" type="number" step="0.01" min="0" max={maxReward / 100} defaultValue={tip.reward_amount_cents != null ? (tip.reward_amount_cents / 100).toFixed(2) : ''} className="input !py-1.5 text-sm" required />
                  <p className="hint">Up to ${(maxReward / 100).toFixed(2)}. The tipster is notified and gets a one-time claim code.</p>
                  <button className="btn !min-h-9 text-xs">{tip.reward_eligible ? 'Update amount' : 'Mark eligible'}</button>
                </form>
                {tip.reward_eligible && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                    <form action={reissueAction}>{hidden}<button className="btn !min-h-9 text-xs">Reissue claim code</button></form>
                    <form action={rewardAction}>{hidden}<input type="hidden" name="eligible" value="0" /><button className="btn !min-h-9 text-xs">Remove eligibility</button></form>
                  </div>
                )}
                <p className="hint">{tip.claim_code_revealed_at ? 'Claim code has been shown to the tipster.' : tip.reward_eligible ? 'Claim code not yet viewed by the tipster.' : ''} Redeem codes on the Rewards page.</p>
              </>
            )}
          </Card>

          <Card title="Internal notes (staff only)">
            <ul className="mb-3 space-y-2">
              {notes.map((n: any) => <li key={n.id} className="rounded-lg bg-amber-50 p-2 text-sm"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-[11px] text-slate-600">{n.author ?? 'Staff'} · {when(n.created_at)}</p></li>)}
              {notes.length === 0 && <li className="text-sm text-slate-600">No notes.</li>}
            </ul>
            <form action={noteAction} className="space-y-2">{hidden}<textarea name="body" className="input text-sm" maxLength={5000} required placeholder="Add a note. The tipster never sees this." /><button className="btn !min-h-9 text-xs">Add note</button></form>
          </Card>
        </div>
      </div>
    </div>
  );
}
