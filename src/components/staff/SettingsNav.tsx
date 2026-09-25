import Link from 'next/link';

const TABS: [string, string][] = [
  ['/staff/settings', 'Organization & escalation'],
  ['/staff/settings/taxonomy', 'Categories, locations & teams'],
  ['/staff/settings/people', 'People & on-call'],
  ['/staff/settings/canned', 'Canned responses'],
];

export function SettingsNav({ current }: { current: string }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Settings sections">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={href === current ? 'page' : undefined} className={`btn !min-h-9 text-sm ${href === current ? '!bg-slate-900 !text-white' : ''}`}>{label}</Link>
      ))}
    </nav>
  );
}
