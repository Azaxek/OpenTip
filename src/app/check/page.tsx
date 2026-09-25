import { redirect } from 'next/navigation';
import { CheckTip } from '@/components/CheckTip';
import { EmergencyBanner } from '@/components/EmergencyBanner';
import { TipsterShell } from '@/components/TipsterShell';
import { getOrg } from '@/lib/org';
import { pushConfigured } from '@/lib/push';

export const metadata = { title: 'Check a tip' };

export default async function CheckPage() {
  const org = await getOrg();
  if (!org) redirect('/setup');
  return (
    <TipsterShell org={org}>
      <div className="space-y-4">
        <EmergencyBanner />
        <CheckTip siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} vapidKey={pushConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : undefined} />
      </div>
    </TipsterShell>
  );
}
