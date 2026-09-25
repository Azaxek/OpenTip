import { DEMO } from '@/lib/demo';

/** Shown on the staff sign-in page in demo mode only. These are public demo credentials for fictional data. */
export function DemoLogins() {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
      <p className="font-bold">Demo logins</p>
      <p>Administrator: <span className="font-mono">{DEMO.admin.email}</span> / <span className="font-mono">{DEMO.admin.password}</span></p>
      <p>Reviewer: <span className="font-mono">{DEMO.reviewer.email}</span> / <span className="font-mono">{DEMO.reviewer.password}</span></p>
    </div>
  );
}
