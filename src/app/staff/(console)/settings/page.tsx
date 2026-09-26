import { SettingsNav } from '@/components/staff/SettingsNav';
import { Card, Flash } from '@/components/staff/ui';
import { withOrg } from '@/lib/db';
import { orgInTx } from '@/lib/org';
import { readiness } from '@/lib/readiness';
import { requireAdmin } from '@/lib/session';
import { saveOrgAction, testAlertAction } from '../../admin-actions';

export const metadata = { title: 'Settings' };

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const org = await withOrg(s.orgId, (q) => orgInTx(q));
  const checks = readiness();
  const f = (label: string, name: string, value: string | number, extra: Record<string, unknown> = {}, hint?: string) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={value} className="input" {...extra} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
  return (
    <div>
      <SettingsNav current="/staff/settings" />
      <Flash e={sp.e} ok={sp.ok} />
      {sp.welcome && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-900">
          <p className="font-bold">Your tip line is live.</p>
          <p>Next: check the server list below, review categories and teams, add reviewers, set your escalation channel, then use Materials to announce it. Read ESCALATION-PROTOCOL.md to decide who is on call.</p>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <form action={saveOrgAction} className="card space-y-4 lg:col-span-2">
          <h2 className="font-bold">Organization</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {f('Name', 'name', org.name, { required: true, maxLength: 120 })}
            {f('Hotline (optional)', 'hotline', org.hotline ?? '', { maxLength: 40 })}
            {f('Brand color', 'primary_color', org.primary_color, { type: 'color', className: 'input h-11 p-1' })}
            {f('Max reward (USD)', 'max_reward', (org.max_reward_cents / 100).toFixed(2), { type: 'number', min: 0, step: '0.01' })}
          </div>

          <h2 className="border-t border-slate-200 pt-4 font-bold">Escalation (urgent alerts)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="escalation_email_mode">Email who?</label>
              <select id="escalation_email_mode" name="escalation_email_mode" defaultValue={org.escalation_email_mode} className="input">
                <option value="on_call">Reviewers marked on-call</option><option value="admins">Administrators</option><option value="off">Nobody by email</option>
              </select>
              <p className="hint">Set who is on call under People. Needs RESEND_API_KEY.</p>
            </div>
            {f('Slack/Discord webhook URL', 'escalation_webhook_url', org.escalation_webhook_url ?? '', { type: 'url', placeholder: 'https://hooks.slack.com/…' }, 'Optional. Fires at the same time as email. Alerts name the tip and link to the console but never include tip content.')}
          </div>

          <h2 className="border-t border-slate-200 pt-4 font-bold">Evidence limits</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {f('Photo / PDF max (MB)', 'image_mb', org.image_mb, { type: 'number', min: 1, max: 100 })}
            {f('Video / audio max (MB)', 'av_mb', org.av_mb, { type: 'number', min: 1, max: 500 })}
            {f('Per-tip total (MB)', 'tip_mb', org.tip_mb, { type: 'number', min: 1, max: 500 })}
            {f('PDF max (MB)', 'doc_mb', org.doc_mb, { type: 'number', min: 1, max: 100 })}
            {f('Max files per tip (0 = off)', 'max_files', org.max_files, { type: 'number', min: 0, max: 30 })}
          </div>

          <h2 className="border-t border-slate-200 pt-4 font-bold">Retention</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {f('Delete idle tips after (days)', 'retention_days', org.retention_days, { type: 'number', min: 1, max: 3650 }, 'Includes files. Enforced daily.')}
            {f('Keep audit log (days)', 'audit_retention_days', org.audit_retention_days, { type: 'number', min: 30, max: 3650 })}
            {f('Provider backup window (days)', 'backup_retention_days', org.backup_retention_days, { type: 'number', min: 0, max: 365 }, 'What your database provider keeps. Shown in the privacy notice. Verify it in your provider console.')}
          </div>
          <h2 className="border-t border-slate-200 pt-4 font-bold">What tipsters read after they submit</h2>
          <div>
            <label className="label" htmlFor="tipster_note">What to expect (reply times, hours)</label>
            <textarea id="tipster_note" name="tipster_note" defaultValue={org.tipster_note} maxLength={600} className="input min-h-20" />
            <p className="hint">Shown above the chat on the status page. Be honest about when a person actually reads tips.</p>
          </div>
          <div>
            <label className="label" htmlFor="help_text">Help resources (shown on the receipt and status page)</label>
            <textarea id="help_text" name="help_text" defaultValue={org.help_text} maxLength={1200} className="input min-h-24" />
            <p className="hint">Crisis lines, victim assistance, local numbers. Replace the sample text with resources for your area.</p>
          </div>
          <button className="btn btn-primary">Save settings</button>
        </form>

        <div className="space-y-4">
        <Card title="Test your alerts">
          <p className="mb-3 text-sm text-slate-700">Sends a clearly-labelled test through every channel you have set up (email to on-call staff and your chat webhook), and tells you what actually got through.</p>
          <form action={testAlertAction}><button className="btn btn-primary">Send a test alert</button></form>
        </Card>
        <Card title="Server checklist">
          <ul className="space-y-3 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex gap-2">
                <span aria-hidden>{c.ok ? '✅' : c.critical ? '❌' : '⚠️'}</span>
                <span><span className="font-semibold">{c.label}</span>{!c.ok && <span className="block text-slate-600">{c.fix}</span>}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-950">
            <strong>24/7 coverage is a staffing decision, not a feature.</strong> This app can alert people instantly; it cannot guarantee someone answers. Define an on-call rotation (ESCALATION-PROTOCOL.md) and keep the 911 notice on the form.
          </p>
        </Card>
        </div>
      </div>
    </div>
  );
}
