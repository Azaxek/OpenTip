import { redirect } from 'next/navigation';
import { SetupForm } from '@/components/staff/SetupForm';
import { getOrg } from '@/lib/org';
import { demoMode } from '@/lib/url';
import { readiness } from '@/lib/readiness';

export const metadata = { title: 'Set up' };

export default async function SetupPage() {
  if (demoMode()) redirect('/demo'); // demo deployments load pre-made data instead of running the wizard
  if (await getOrg()) redirect('/staff/login');
  const checks = readiness();
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4">
      <h1 className="pt-4 text-3xl font-extrabold">Set up your tip line</h1>
      <p className="text-slate-700">Two minutes: tell us about your program and create the first administrator. You can change everything later.</p>
      <details className="card" open={checks.some((c) => !c.ok && c.critical)}>
        <summary className="cursor-pointer font-semibold">Server checklist</summary>
        <ul className="mt-3 space-y-2 text-sm">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-2">
              <span aria-hidden>{c.ok ? '✅' : c.critical ? '❌' : '⚠️'}</span>
              <span><span className="font-semibold">{c.label}</span>{!c.ok && <span className="block text-slate-600">{c.fix}</span>}</span>
            </li>
          ))}
        </ul>
      </details>
      <SetupForm />
    </main>
  );
}
