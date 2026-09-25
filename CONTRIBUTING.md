# Contributing

Thank you for helping. This project holds tips from people who are trusting it with their safety, so the bar on anonymity is higher than in a typical web app.

## Setup

```bash
npm install
npm run keys        # secrets for .env.local (see README)
npm run dev:db      # local Postgres (PGlite) for trials
npm run dev
npm test            # no database or accounts required
npm run typecheck
npm run build
```

Tests run the real SQL migrations on in-process Postgres (PGlite), so they exercise real row-level security and real bind parameters. No mocks of the database.

## Anonymity rules (a PR that breaks one will not be merged)

1. **Never read, log, store or forward IP addresses, user agents, or other request metadata** on tipster-facing code. The only permitted reader of client-address headers is `src/lib/ratelimit.ts`, and it keeps them in memory. A test enforces this.
2. **Adding a column to `tips`, `messages`, `media` or `push_subscriptions`?** You must also add it, with a plain-language description, to `TIPSTER_DATA` in `src/lib/transparency.ts`. The public privacy notice is generated from it and a test fails if they differ. A column that could identify a person or device will not be accepted.
3. **No third-party scripts, analytics, fonts or trackers** on tipster pages. Turnstile is the only exception.
4. **Secrets are hashed** (argon2id). Nothing reversible, nothing logged.
5. **Evidence is never stored unsanitized.** New file types need a strip-and-verify test in `tests/media.test.ts`.
6. **The 911 banner stays**: `EmergencyBanner` takes no props that reword or hide it.
7. **Every tenant table gets `org_id` and an RLS policy**, and is added to the list in `tests/tenancy.test.ts`.
8. **Every staff action on a tip goes through the shared guard** in `src/lib/queue.ts` so team routing cannot be bypassed.

## Layout

```
db/migrations/     SQL, applied in order by scripts/migrate.mjs (also run on Vercel builds)
src/lib/           all business logic (testable without Next)
  db.ts            withOrg() = RLS-scoped transaction; system() = owner role (setup/cron only)
  tipster.ts       submit, TIP ID login, chat, claim code
  queue.ts         everything reviewers do, behind one visibility guard
  media.ts         type sniffing + metadata stripping
  purge.ts         retention
  escalation.ts    alerting
src/app/api/       thin public routes (rate limit → Turnstile → validate → lib)
src/app/staff/     reviewer console (server components + server actions)
src/components/    client components (wizard, chat, push opt-in)
tests/             Vitest suites; helpers.ts builds orgs, staff and tips
```

## Conventions

* Keep route handlers thin; put logic in `src/lib` and test it there.
* Don't nest `withOrg` calls (deadlocks small connection pools).
* Parameters must all be referenced in the SQL (real Postgres rejects unused bind parameters).
* Prefer the platform and the standard library to new dependencies. Every dependency parses hostile input somewhere; justify additions.
* Write the smallest change that solves the problem, with a test for anything that touches a trust boundary.

## Adding an SIS connector

Implement `LocationConnector` in `src/lib/sis.ts` (return `{externalId, name}[]` for schools only, never student data), then call `syncLocations(admin, connector)` from an admin action or a cron route. Add a test like the CSV ones.

## Reporting security issues

Privately, via your fork's GitHub “Report a vulnerability”, not a public issue.
