import { redirect } from 'next/navigation';
import { TipsterShell } from '@/components/TipsterShell';
import { getOrg } from '@/lib/org';
import { TIPSTER_DATA } from '@/lib/transparency';

export const metadata = { title: 'What we store' };

export default async function Privacy() {
  const org = await getOrg();
  if (!org) redirect('/setup');
  return (
    <TipsterShell org={org}>
      <article className="space-y-6">
        <h1 className="text-2xl font-extrabold">What we store, and what we don&apos;t</h1>
        <section className="card space-y-2">
          <h2 className="font-bold">We do not collect</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Your name, email address or phone number</li>
            <li>Your IP address, device details or browser details</li>
            <li>Analytics, advertising or tracking scripts (there are none on these pages)</li>
            <li>Hidden details inside files you upload: location, camera, date and author are removed on our server before anything is saved</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h2 className="font-bold">What is stored about your tip</h2>
          <p className="text-sm text-slate-700">This list is checked automatically against the real database structure, so it cannot quietly go out of date.</p>
          {Object.entries(TIPSTER_DATA).map(([table, cols]) => (
            <details key={table} className="rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer font-semibold">{table.replace('_', ' ')} <span className="font-normal text-slate-600">({Object.keys(cols).length} fields)</span></summary>
              <dl className="mt-2 space-y-1 text-sm">
                {Object.entries(cols).map(([c, d]) => (
                  <div key={c} className="flex gap-2"><dt className="w-48 shrink-0 font-mono text-xs">{c}</dt><dd>{d}</dd></div>
                ))}
              </dl>
            </details>
          ))}
        </section>

        <section className="card space-y-2 text-sm">
          <h2 className="font-bold">How long we keep it</h2>
          <p>Tips with no activity for <strong>{org.retention_days} days</strong> are permanently deleted, along with their messages and files. Staff activity logs (which record staff, never tipsters) are kept for {org.audit_retention_days} days.</p>
          <p>Our hosting and database provider may keep automatic backups for up to <strong>{org.backup_retention_days} days</strong> after deletion.</p>
        </section>

        <section className="card space-y-2 text-sm">
          <h2 className="font-bold">Other services involved</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Cloudflare Turnstile</strong> checks that you are a person, not a bot. It runs when you submit a tip or sign in.</li>
            <li><strong>Our web host, database and file storage providers</strong> process your data on our behalf. Their infrastructure may briefly handle network details such as your IP address to deliver the page; this app does not record or store them.</li>
            <li><strong>Your browser&apos;s push service</strong> (Google, Apple or Mozilla) is involved only if you turn on notifications.</li>
          </ul>
          <p>Anything you write or upload will be read by {org.name} staff. Do not include information you are not comfortable sharing with them: your own name, a signature in a photo, or a voice you would not want recognized.</p>
        </section>
      </article>
    </TipsterShell>
  );
}
