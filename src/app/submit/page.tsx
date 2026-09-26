import { redirect } from 'next/navigation';
import { SubmitWizard } from '@/components/SubmitWizard';
import { TipsterShell } from '@/components/TipsterShell';
import { withOrg } from '@/lib/db';
import { ACCEPT } from '@/lib/media';
import { getOrg } from '@/lib/org';
import { pushConfigured } from '@/lib/push';

export const metadata = { title: 'Submit a tip' };

export default async function SubmitPage() {
  const org = await getOrg();
  if (!org) redirect('/setup');
  const { categories, locations } = await withOrg(org.id, async (q) => ({
    categories: await q<{ id: string; name: string; description: string; high_risk: boolean }>('select id, name, description, high_risk from categories where active order by sort, name'),
    locations: await q<{ id: string; name: string }>('select id, name from locations where active order by name'),
  }));
  return (
    <TipsterShell org={org}>
      <SubmitWizard
        orgName={org.name}
        hotline={org.hotline}
        helpText={org.help_text}
        categories={categories}
        locations={locations}
        limits={{ imageMb: org.image_mb, docMb: org.doc_mb, avMb: org.av_mb, tipMb: org.tip_mb, maxFiles: org.max_files }}
        accept={ACCEPT.join(',')}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        vapidKey={pushConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : undefined}
      />
    </TipsterShell>
  );
}
