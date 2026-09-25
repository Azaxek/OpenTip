import Link from 'next/link';

/** Thin banner shown on every page of a DEMO_MODE deployment so nobody mistakes it for a live tip line. */
export function DemoBar() {
  return (
    <div className="bg-slate-900 px-4 py-1.5 text-center text-xs font-semibold text-white" data-testid="demo-bar">
      DEMO with sample data. Do not submit real tips. Resets every night.{' '}
      <Link href="/demo" className="underline underline-offset-2">Presenter guide &amp; logins</Link>
    </div>
  );
}
