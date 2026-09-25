import { redirect } from 'next/navigation';
import { DemoLogins } from '@/components/DemoLogins';
import { LoginForm } from '@/components/staff/LoginForm';
import { getOrg } from '@/lib/org';
import { currentStaff } from '@/lib/session';
import { demoMode } from '@/lib/url';

export const metadata = { title: 'Staff sign in' };

export default async function StaffLogin() {
  const org = await getOrg();
  if (!org) redirect('/setup');
  if (await currentStaff()) redirect('/staff');
  return (
    <main className="mx-auto max-w-sm space-y-4 p-4 pt-12">
      <h1 className="text-2xl font-extrabold">{org.name}</h1>
      <p className="text-slate-700">Reviewer console. Staff only.</p>
      {demoMode() && <DemoLogins />}
      <LoginForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </main>
  );
}
