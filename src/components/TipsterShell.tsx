import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Org } from '@/lib/org';
import { QuickExit } from './QuickExit';

/** Chrome for tipster-facing pages. Deliberately free of analytics, trackers and third-party scripts. */
export function TipsterShell({ org, children }: { org: Org; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2 focus:shadow">Skip to content</a>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <Link href="/" className="inline-flex min-h-11 items-center text-lg font-bold" style={{ color: 'var(--brand)' }}>
          {org.name}
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="Main">
          <Link href="/submit" className="link inline-flex min-h-11 items-center px-2">Submit a tip</Link>
          <Link href="/check" className="link inline-flex min-h-11 items-center px-2">Check a tip</Link>
          <QuickExit />
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 pb-10 outline-none">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-xs text-slate-600">
        <Link href="/privacy" className="link inline-flex min-h-11 items-center">What we store and don&apos;t store</Link>
        <span className="mx-2">·</span>
        Anonymous by design: no accounts, no analytics, no tracking scripts.
      </footer>
    </div>
  );
}
