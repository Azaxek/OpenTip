import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmergencyBanner } from '@/components/EmergencyBanner';
import { TipsterShell } from '@/components/TipsterShell';
import { getOrg } from '@/lib/org';

export default async function Home() {
  const org = await getOrg();
  if (!org) redirect('/setup');
  const campus = org.org_type === 'campus';
  return (
    <TipsterShell org={org}>
      <div className="space-y-6">
        <EmergencyBanner />
        <section className="card space-y-4 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">{campus ? 'See something? Say something.' : 'Know something? Tell us.'}</h1>
          <p className="text-slate-700">
            Report {campus ? 'bullying, threats, safety concerns, or someone who needs help' : 'crime or a safety concern'} to {org.name} without giving your name.
            We do not collect your name, phone number, email, IP address or device details.
          </p>
          <Link href="/submit" className="btn btn-primary w-full !min-h-14 text-lg">Submit a Tip</Link>
          <Link href="/check" className="btn w-full">Check an Existing Tip</Link>
          {org.hotline && (
            <p className="text-sm text-slate-700">
              Prefer to talk? Call <a className="link" href={`tel:${org.hotline.replace(/[^+\d]/g, '')}`}>{org.hotline}</a>.
            </p>
          )}
        </section>
        <section className="card text-sm text-slate-700">
          <h2 className="mb-2 font-bold text-slate-900">How it works</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Tell us what you know. Add photos, video, audio or a PDF if you have them.</li>
            <li>You choose a passcode. You get a TIP ID. Neither can be recovered, so save them.</li>
            <li>Come back with your TIP ID and passcode to chat with a reviewer, still anonymously.</li>
          </ol>
        </section>
      </div>
    </TipsterShell>
  );
}
