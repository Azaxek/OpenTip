import { Card, PageTitle } from '@/components/staff/ui';
import { defaultLetter, submitUrl } from '@/lib/materials';
import { getOrg } from '@/lib/org';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Rollout materials' };

export default async function Materials() {
  await requireAdmin();
  const org = (await getOrg())!;
  return (
    <div className="space-y-4">
      <PageTitle>Rollout materials</PageTitle>
      <p className="text-sm text-slate-700">Everything you need to announce the tip line, generated from your settings. Points at <span className="font-mono">{submitUrl()}</span>. If that address is wrong, set APP_URL and redeploy.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Poster / flyer (PDF)">
          <p className="mb-3 text-sm text-slate-700">Letter-size poster with your name, brand color, hotline, a large QR code and the 911 notice. Print and post.</p>
          <a className="btn btn-primary" href="/staff/materials/poster">Download poster</a>
        </Card>
        <Card title="QR code (PNG)">
          <p className="mb-3 text-sm text-slate-700">High-resolution QR linking straight to the submission page, for slides, newsletters and social posts.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/staff/materials/qr" alt="QR code to the tip form" className="mb-3 size-40 rounded border border-slate-200" />
          <a className="btn" href="/staff/materials/qr">Download PNG</a>
        </Card>
      </div>
      <Card title="Parent / community letter (PDF)">
        <form action="/staff/materials/letter" method="post" className="space-y-3">
          <p className="text-sm text-slate-700">Pre-filled with your name and hotline. Edit freely before downloading.</p>
          <textarea name="body" defaultValue={defaultLetter(org)} className="input min-h-96 font-mono text-sm" maxLength={8000} />
          <button className="btn btn-primary">Download letter</button>
        </form>
      </Card>
    </div>
  );
}
