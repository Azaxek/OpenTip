import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { DemoBar } from '@/components/DemoBar';
import { RegisterSW } from '@/components/RegisterSW';
import { brandForeground } from '@/lib/brand';
import { getOrg } from '@/lib/org';
import { demoMode } from '@/lib/url';
import './globals.css';

// Everything here reads the database per request; nothing is prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Anonymous Tip Line', template: '%s | Anonymous Tip Line' },
  description: 'Submit an anonymous tip. No account, no tracking.',
  appleWebApp: { capable: true, title: 'Tip Line', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1d4ed8' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const org = await getOrg().catch(() => null);
  const brand = org?.primary_color ?? '#1d4ed8';
  return (
    <html lang="en">
      <body style={{ '--brand': brand, '--brand-fg': brandForeground(brand) } as CSSProperties}>
        <RegisterSW />
        {demoMode() && <DemoBar />}
        {children}
      </body>
    </html>
  );
}
