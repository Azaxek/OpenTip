import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Org } from '@/lib/org';

/** Chrome for tipster-facing pages. Deliberately free of analytics, trackers and third-party scripts. */
export function TipsterShell({ org, children }: { org: Org; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-bold" style={{ color: 'var(--brand)' }}>
          {org.name}
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/submit" className="link">Submit a tip</Link>
          <Link href="/check" className="link">Check a tip</Link>
        </nav>
      </header>
      <main className="flex-1 pb-10">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-xs text-slate-600">
        <Link href="/privacy" className="link">What we store and don&apos;t store</Link>
        <span className="mx-2">·</span>
        Anonymous by design: no accounts, no analytics, no tracking scripts.
      </footer>
    </div>
  );
}
