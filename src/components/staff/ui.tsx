import type { ReactNode } from 'react';

export const STATUS_LABEL: Record<string, string> = { new: 'New', under_review: 'Under review', actioned: 'Actioned', closed: 'Closed' };
const TONE: Record<string, string> = { new: 'bg-blue-100 text-blue-900', under_review: 'bg-amber-100 text-amber-900', actioned: 'bg-green-100 text-green-900', closed: 'bg-slate-200 text-slate-800' };

export const StatusBadge = ({ status }: { status: string }) => <span className={`badge ${TONE[status] ?? TONE.closed}`}>{STATUS_LABEL[status] ?? status}</span>;

export const UrgentBadge = () => <span className="badge bg-red-700 text-white">URGENT</span>;

/** Red/green banners driven by ?e= and ?ok= so server actions can report problems without crashing. */
export function Flash({ e, ok }: { e?: string; ok?: string }) {
  return (
    <>
      {e && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{e}</p>}
      {ok && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-900">{ok}</p>}
    </>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && <h2 className="mb-3 font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export const when = (d: Date | string) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function ago(d: Date | string) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
