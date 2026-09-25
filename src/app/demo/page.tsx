import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DemoLoader } from '@/components/DemoLoader';
import { DEMO, demoStatus } from '@/lib/demo';
import { demoMode } from '@/lib/url';

export const metadata = { title: 'Demo guide' };
export const maxDuration = 60; // loading the demo hashes several passwords and processes sample evidence

const STEPS: [string, string][] = [
  ['Start as an anonymous tipster (phone-sized window)', 'Open the home page. Point out the red 911 notice that cannot be turned off. Tap Submit a Tip → Weapons → “Yes, urgent” (a louder 911 notice appears) → describe → attach a photo (say it is stripped of location and camera data on our server) → choose a passcode.'],
  ['The receipt', 'Show the TIP ID and passcode and the “we cannot recover these” warning, the copy button, and the printable card that contains only the TIP ID. Message: there is no account, no phone number and no email involved.'],
  ['What we store, in plain language', 'Open “What we store and don’t store” in the footer. Every field is listed, and an automated test fails the build if that list ever differs from the real database.'],
  ['Switch to the reviewer console', 'Sign in as the administrator. The urgent Weapons tip you just made is pinned at the top in red with “Awaiting reply”. Open it: description, evidence photo, team routing (which team sees what), internal notes.'],
  ['Live anonymous chat', 'Reply from the console (try “Insert canned response…”). Flip to the tipster window: the reply appears without refreshing, and the status becomes Under review. The tipster never sees the reviewer’s name.'],
  ['Escalate', 'Press “Escalate now” on the urgent tip. In this demo the alert is simulated; live, it emails every on-call person and posts to Slack/Discord at the same moment, records who pressed it, and warns loudly if nothing could be delivered. Open the Audit log to show it recorded.'],
  ['The reward flow', `In a new private window go to Check a Tip and sign in as the tipster (${DEMO.tipster.tipId} / ${DEMO.tipster.passcode}). It shows “Reward eligible”: tap Show my claim code (shown once, stored only as a hash). Then in the console open Rewards, enter that TIP ID and code, and Verify & mark claimed. Payout stays in your existing process.`],
  ['Analytics for the board', 'Open Analytics: ten weeks of volume, categories, closure reasons, median time to first response and to closure, and rewards paid. Export CSV or PDF (exports are audit-logged).'],
  ['Rollout materials', 'Open Materials: a print-ready poster with a QR code to the submission page, an editable parent/community letter, and a QR image. Nothing to design.'],
  ['Make it yours and close', 'Settings shows categories, teams (each team sees only its tips), on-call staff, retention and escalation channels. Close on cost and ownership: it runs on free tiers, and the program owns its data.'],
];

export default async function DemoGuide() {
  if (!demoMode()) notFound();
  const { loaded } = await demoStatus();
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-16">
      <h1 className="pt-4 text-3xl font-extrabold">Demo guide</h1>
      <p className="text-slate-700">A ready-made fictional Crime Stoppers program, {DEMO.orgName}, for presenting OpenTip. Everything here is sample data; nothing is real.</p>

      {loaded ? (
        <>
          <section className="card space-y-3">
            <h2 className="font-bold">Logins</h2>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="font-semibold">Administrator</dt><dd className="font-mono break-all">{DEMO.admin.email} / {DEMO.admin.password}</dd>
              <dt className="font-semibold">Reviewer</dt><dd className="font-mono break-all">{DEMO.reviewer.email} / {DEMO.reviewer.password}</dd>
              <dt className="font-semibold">Tipster (reward tip)</dt><dd className="font-mono break-all">TIP ID {DEMO.tipster.tipId} / passcode {DEMO.tipster.passcode}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className="btn">Public site</Link>
              <Link href="/submit" className="btn">Submit a tip</Link>
              <Link href="/check" className="btn">Check a tip</Link>
              <Link href="/staff/login" className="btn btn-primary">Reviewer console</Link>
            </div>
          </section>

          <section className="card">
            <h2 className="mb-3 font-bold">A 10-minute walkthrough for your sponsor</h2>
            <ol className="space-y-4">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">{i + 1}</span>
                  <div><p className="font-semibold">{title}</p><p className="text-sm text-slate-700">{body}</p></div>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <p className="rounded-lg bg-amber-100 p-3 text-sm font-semibold text-amber-950">The demo data has not been loaded yet. Load it below (one time), then reload this page.</p>
      )}

      <DemoLoader loaded={loaded} />

      <section className="card text-sm text-slate-700">
        <h2 className="mb-1 font-bold">Good to know while presenting</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Demo mode needs no file bucket, bot-check or email account. Evidence is kept in the database and capped at about 4 MB per file. A real deployment uses private object storage.</li>
          <li>Escalation alerts are simulated here and labelled as such. In production they go to real email and chat channels.</li>
          <li>Anything typed during the demo is deleted by the nightly reset or the button above. Never enter real information.</li>
        </ul>
      </section>
    </main>
  );
}
