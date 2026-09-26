# UX audit and roadmap: making OpenTip the best tip line

**What this is.** A hands-on test of OpenTip from the three seats that matter (the **tipster**, the **administrator**, the **reviewer**), the glitches found, what was fixed in the same pass, and a prioritized plan for everything else. Written after the first full build so the next steps are based on evidence, not opinion.

## 1. How it was tested (and what could not be)

* A production build (the same kind Vercel serves, with the service worker active) was driven by a scripted Microsoft Edge: a 390×844 touch phone for the tipster, a 1440×900 desktop for the console, plus throttled "slow 3G", offline mode, a 320px-wide phone, and automated accessibility scans (axe-core, WCAG 2.x A/AA + best practice).
* More than **100 scripted checks** across three suites (tipster, administrator, reviewer), each written as a user goal ("a tipster on a school network can still submit", "a reviewer who un-routes a tip is told why"). Failures were fixed and the same checks re-run against a fresh build.
* Two instances were used: the **demo** (seeded, on a local Postgres) and an untouched **first-run** instance with Cloudflare's always-pass Turnstile test keys, so real bot-check behavior and the setup wizard were exercised, not mocked.
* Evidence uploads used real video, audio and PDF files carrying planted metadata (title, artist, author, GPS); none survived storage.

**Not covered; do these before launch:** real iPhone/Android devices (Safari quirks, HEIC, install prompts), Web Push on a real phone, a screen reader session (NVDA/VoiceOver), the interactive Turnstile challenge, real Cloudflare R2 / Neon / Vercel / Resend, load and concurrency testing, and, most important, **moderated sessions with real tipsters, reviewers and coordinators**. A script can find broken things; it cannot tell you whether a frightened 15-year-old trusts the form.

## 2. Verdict by seat

| Seat | Verdict before | After this pass |
|---|---|---|
| **Tipster** | Fast, private and mostly clear, but had traps: a file the form accepted and the server later refused (after the passcode was typed), an empty-tip error shown last, no upload progress, "Failed to fetch" offline, and a shared school network could block honest tipsters. | Traps removed. Remaining gaps are *reach* (language, six-screen length, slow-network uploads), not correctness. |
| **Administrator** | Setup was quick, but one wrong entry wiped the whole setup form; errors said "check the highlighted fields" with nothing highlighted; no way to test alerts. | Form keeps your input, errors name the field and the rule, test-alert button added. Gaps: invites/2FA, readable audit log, category ordering. |
| **Reviewer** | Solid core (routing, chat, evidence, rewards) but **no alert when a new tip arrives**, no search, a queue that doesn't refresh, and a bare 404 if you un-route your own tip. | 404 and console semantics fixed. New-tip alerts, live queue, search and mobile layout are the top items in the plan. |

## 3. What is already strong (protect these)

* **Speed:** landing page ~1 s to first paint, ~148 KB total on a cold load; usable on slow 3G in ~5.5 s.
* **Privacy footprint:** zero cookies, zero third-party requests, nothing identifying in storage, strict headers; 320px-safe; double-tapping Submit creates exactly one tip; pasted HTML is shown as inert text on both sides.
* **Evidence pipeline:** video, audio and PDF accepted, sanitized (planted titles, artists, authors and GPS all gone) and stored in under a second for three files.
* **Trust details:** identical error for wrong ID / wrong passcode / locked; TIP IDs accept sloppy typing; one-time claim code; receipt card with TIP ID only; the 911 notice on every screen.
* **Access control:** reviewers bounce off admin pages; signed-out visitors get 401 on media and exports; Back after sign-out shows nothing.
* **Real-time chat:** reviewer→tipster ~3.4 s, tipster→reviewer ~0.9 s (polling).

## 4. Findings

Severity: **High** = loses a tip, blocks a person, or hides an emergency; **Medium** = wastes time or confuses; **Low** = polish. *Fixed* = corrected and re-verified in this pass; *Open* = in the plan below.

### Tipster

| # | Finding | Sev | Status |
|---|---|---|---|
| T-1 | The form accepted **iPhone HEIC** (any `image/*`) but the server refuses it, so the tipster only found out at the very last step, with a vague message and no hint which file | High | **Fixed:** exact-type check up front with advice ("choose JPEG… Most Compatible") |
| T-2 | **Shared network lockout:** limits were 10 submissions/hour and 10 sign-ins/15 min *per IP*. A school or carrier network could block an honest tipster after they'd finished the whole form | High | **Fixed:** anonymous limits raised (60/hour, 60/15 min), signed-in actions limited per tip |
| T-3 | Empty tip was only rejected at the very last step, after typing a passcode | Med | **Fixed:** caught at the evidence step |
| T-4 | Focus stayed on the "Next" button, so screen-reader and keyboard users weren't told the step changed | Med | **Fixed:** focus moves to the new step (labelled "Step N of M") |
| T-5 | Browser's disappearing "lengthen this text" bubble pre-empted the form's own clear message | Low | **Fixed** |
| T-6 | Reload sent you back to step 1 (text was kept, place was lost) | Low | **Fixed:** returns to the same screen (never past the last content step; files and passcode are never saved) |
| T-7 | No drag-and-drop zone (the brief required one) | Med | **Fixed** |
| T-8 | Upload progress was text only, no bar | Med | **Fixed:** progress bar and percent |
| T-9 | Submitting offline showed "Failed to fetch" | Med | **Fixed:** "We couldn't reach the server… your answers are still on this screen" |
| T-10 | Status page never said when to expect a reply or where to find crisis help | High (campus) | **Fixed:** admin-editable "what to expect" and "help resources" |
| T-11 | Expired session silently dumped the tipster on the sign-in form | Low | **Fixed:** explains why |
| T-12 | Header links and select were 40–41 px (target 44) and the wizard had no `<h1>` | Low | **Fixed** |
| T-13 | No way to leave quickly if someone walks in (abuse, coercion, monitored device) | High (safety) | **Fixed:** *Quick exit* button + Esc twice: clears the tab, replaces the page, no Back path |
| T-14 | **English only** | High (reach) | Open |
| T-15 | Six screens / about 12 interactions to send a tip | Med | Open ("quick tip" mode) |
| T-16 | Big videos on a phone connection take minutes, with no cancel/retry/resume | Med | Open (resumable + client-side downscale) |
| T-17 | Cold load on slow 3G is 5.5 s | Low | Open |
| T-18 | Locked tipster only sees a generic "15 minutes" | Low | Open |

### Administrator

| # | Finding | Sev | Status |
|---|---|---|---|
| A-1 | **Setup wizard wiped every field** (including the org-type choice) when the setup token was wrong; React 19 resets `<form action>` fields on error | High | **Fixed** (same fix on the demo loader) |
| A-2 | Validation errors said "Please check the highlighted fields" but nothing was highlighted and the field/rule wasn't named | Med | **Fixed:** e.g. "Retention (days) must be at least 1." |
| A-3 | No way to prove alerts work before an emergency | High | **Fixed:** *Send a test alert*, reporting per channel what got through |
| A-4 | Console had no `<main>`, no `<h1>`, no skip link; an unlabelled file picker | Med | **Fixed** |
| A-5 | Reordering categories means typing a "Sort" number; no preview of the tipster form | Med | Open |
| A-6 | Staff are given hand-made temporary passwords; no invite email, no forgot-password, **no two-factor sign-in** | High | Open |
| A-7 | Audit log shows raw codes (`settings.category`, JSON) and has no filter or export | Med | Open |
| A-8 | Analytics: single period only; no compare, no click-through to the tips behind a bar | Med | Open |
| A-9 | One poster/letter for the whole org; English only; one size | Low | Open |
| A-10 | If `APP_URL` isn't set outside Vercel, QR codes silently point at `localhost` | Med | Open (warn loudly on the Materials page) |

### Reviewer

| # | Finding | Sev | Status |
|---|---|---|---|
| R-1 | **No alert when a new tip arrives**: someone must watch the queue; only *Escalate* sends anything | High | Open (top of the plan) |
| R-2 | Queue doesn't refresh (verified: a new tip did not appear in 8 s) and shows no "N awaiting reply" summary | High | Summary and heading **fixed**; live refresh Open |
| R-3 | Un-routing (or reassigning) a tip you can no longer see dropped you on a bare "404" | Med | **Fixed:** back to the queue with an explanation |
| R-4 | No search (by TIP ID or keyword) | High | Open |
| R-5 | No waiting-time timer or overdue highlight (SLA) | High | Open |
| R-6 | Actions succeed silently: no "Saved" confirmation | Med | Open |
| R-7 | On a phone the six filter dropdowns fill the first screen and the table columns are cut off | Med | Open |
| R-8 | No per-tip timeline, no case-file export/print, no image zoom | Med | Open |
| R-9 | Keyboard: first Tab stop was the whole header (no skip link) | Low | **Fixed** |

## 5. How this compares with P3-style products

*Caveat: I have not used P3 Tips / P3 Campus. This compares against the feature list in your brief and general knowledge of tip-line products. Check the gaps below against a real demo before quoting them to anyone.*

**At parity on paper (built and tested):** anonymous submission with TIP ID + passcode, org/school routing to teams, two taxonomies, photo/video/audio/PDF, one-time ID display, live two-way anonymous chat, anonymous push, reward flow with claim code, reviewer console with canned replies and closure reasons, urgent flagging and escalation, analytics, SIS location import, rollout materials.

**Where OpenTip can win:**

1. **Radical transparency**: a public privacy page generated from the real database schema and checked in CI; an open codebase a district's lawyer can read. Commercial products can't offer that.
2. **Cost and ownership**: free tiers, no per-seat license, the program owns its data.
3. **Safety details commercial forms often skip**: Quick exit, help resources at the moment of need, honest "what to expect" text, a 911 notice that can't be configured away.
4. **Proof, not promises**: a test-alert button and an evidence pipeline verified with planted metadata.

**Where a commercial product is likely ahead (and what to do):**

| Gap | Response |
|---|---|
| Staff notifications, live queue, SLAs | Phase 1 |
| Languages | Phase 1 |
| Vendor-staffed 24/7 monitoring and support | Not something software can copy. Offer a *monitoring partner* pattern: escalation webhooks to a partner call center, or a co-op of neighboring programs sharing on-call. Say so honestly |
| Native apps | The PWA covers install and push; measure before building native |
| SMS "text-a-tip", voice line | Phase 3, with explicit privacy caveats (carriers see numbers; use an anonymizing relay) |
| Integrations / API | Phase 2 |
| Compliance paperwork (accessibility conformance report, security questionnaire, pen test) | Phase 1 for a11y + pen test; docs pack in Phase 3 |

## 6. Action plan

Effort: **S** ≤ 1 day, **M** 2–5 days, **L** 1–3 weeks (one experienced developer). Every item lists how you'll know it's done.

### Phase 0: done in this pass
Everything marked **Fixed** above, plus tests (84 automated tests pass) and updated docs. Set up the audit as a repeatable script (see Phase 1, item 12).

### Phase 1: pilot-ready (next 2–3 weeks)

| # | Item | Effort | Done when |
|---|---|---|---|
| 1 | **New-tip alerts** to the routed team (email + chat webhook), instant for urgent/high-risk, optional digest; content-free like escalations | M | A new tip reaches on-call staff within a minute on every configured channel; test-alert covers it |
| 2 | **Live queue**: auto-refresh, live "N awaiting reply / N urgent" counts, browser title badge | S–M | New tip appears without reload in ≤ 10 s |
| 3 | **SLA timers**: "waiting 3 h" badge, overdue highlight, per-org thresholds, first-response target on Analytics | M | Overdue tips are visibly distinct; analytics shows % within target |
| 4 | **Search + saved filters** (TIP ID, keyword in description/messages/notes) | M | Find any tip by any word in ≤ 2 s on 10k tips |
| 5 | **Mobile console**: collapsible filters, card list, thumb-reach reply and status controls | M | A reviewer can triage and reply one-handed on a 390px phone |
| 6 | **Action feedback**: "Saved" toasts and pending states on every staff button | S | No silent success anywhere |
| 7 | **Invites, password reset by email, TOTP two-factor** for staff | M | New staff onboard without an admin ever seeing their password; 2FA can be required org-wide |
| 8 | **Languages**: string catalog, Spanish first, per-org enabled languages, language picker (no cookies: remembered in the tab) | M–L | Whole tipster flow + privacy page in Spanish; reviewer sees the tipster's language tag |
| 9 | **Quick tip mode**: category + description + submit, with a generated three-word passphrase (copy button), everything else optional afterwards | M | Median time to receipt ≤ 90 s text-only |
| 10 | **Upload robustness**: client-side photo downscale + re-encode (also strips metadata on-device), resumable/retry uploads, cancel button | M | A 12 MB phone photo uploads in seconds on 4G; a dropped connection resumes |
| 11 | **Real-world QA**: iPhone Safari, Android Chrome, Samsung Internet; Web Push on real phones; PWA install; interactive Turnstile; screen-reader pass; WCAG 2.2 AA review; external penetration test | M (mostly scheduling) | Written sign-off; zero critical/serious accessibility issues |
| 12 | **Promote this audit to CI**: the Playwright scripts against in-process Postgres, run on every push | M | CI fails if any of today's passing checks regress |
| 13 | **Materials safety net**: warn when `APP_URL` is `localhost` or missing | S | Poster page shows a red banner instead of a wrong QR |

### Phase 2: better than the competition (weeks 4–8)

| # | Item | Effort | Why |
|---|---|---|---|
| 14 | **Case-file export**: one PDF/ZIP with description, chat transcript, notes and evidence, plus **share with a partner agency** by expiring secure link | M–L | The single most requested hand-off in practice; keeps tips out of personal email |
| 15 | **Per-tip timeline and handoffs**: who did what, internal mentions, "hand to Counseling" | M | Continuity across shifts |
| 16 | **Related-tip linking**: same plate/phone/address/name detected locally (no third-party AI) and suggested | L | Turns isolated tips into cases |
| 17 | **Crime Stoppers public bulletins**: "Crime of the Week", wanted list, and *tip on case #123* deep links that pre-attach the case number | M–L | Core to how programs solicit tips; measurable |
| 18 | **Campaign attribution** without tracking people: poster QR codes carry `?src=lincoln-hall`; only aggregate counts are kept | S–M | Shows which outreach works |
| 19 | **Reward ledger**: budget, approvals, payout method, receipts, anonymous payout options, annual report | M | Auditors and boards ask for it |
| 20 | **API and webhooks**: new tip, status change, closure; CSV export | M | Lets RMS/CAD, Slack, Zapier plug in |
| 21 | **Admin polish**: drag-to-reorder categories with live preview, readable and filterable audit log with export, emergency-readiness score, per-location and multi-size materials | M | Removes the remaining admin friction |
| 22 | **After-hours auto-reply and coverage calendar** ("we're closed until Monday; urgent → 911/988") | S–M | Honest expectations; fewer panicked follow-ups |

### Phase 3: platform (a quarter)

* **Model B** multi-tenant hosting (subdomains, per-tenant domains, platform admin), for coalitions.
* **SMS text-a-tip** through an anonymizing relay, with plain warnings about carrier visibility.
* **Analytics 2.0**: compare periods, drill-through, location heat by *named location* (never coordinates), campaign effectiveness.
* **Reliability pack**: status/health endpoint, uptime monitoring guide, load test results, disaster-recovery runbook, security questionnaire and accessibility conformance report.
* **Monitoring co-op** playbook and directory (shared on-call between programs).

## 7. Measuring "flawless" without spying on anyone

Because the product deliberately collects no analytics on tipsters, quality is measured two ways:

1. **Moderated usability sessions** (5 tipsters including teenagers for campus, 3 reviewers, 2 coordinators): scripted tasks, think-aloud, no recordings of faces or identities. Targets: ≥ 90% task success unaided, SUS ≥ 80, zero "I didn't know what to do next" on the tip-sending path.
2. **Aggregate, anonymous server metrics** the software already has or can add without identifying anyone: tips per day, upload-start vs tip-received ratio, share of tips with a reviewer reply, median time to first response, % of urgent tips acknowledged within the target, escalation delivery success. Never per-person.

Also track: LCP < 2.5 s on 4G, accessibility scan with zero critical/serious, setup completed unaided in < 15 minutes, and zero "alert didn't arrive" incidents in monthly test-alert drills.

## 8. Risks to manage

* **Feature creep vs anonymity.** Every item is checked against SECURITY.md. Translation of tip content by a cloud service, SMS, and maps all leak something; each needs an explicit, documented trade-off (or an opt-in).
* **Coverage promises.** The biggest real-world risk is a program advertising monitoring it doesn't have. Keep the honest "what to expect" text and the escalation protocol front and center.
* **Staff account compromise** is the largest realistic breach path: 2FA (item 7) moves up if there's any delay.
* **Single-region, single-vendor stack.** Document the recovery path; consider a second region and backup restores in Phase 3.

## 9. Recommended order if you only have two weeks

1. New-tip alerts (1) → live queue and SLA timers (2, 3) → search (4)
2. Staff invites + 2FA (7)
3. Spanish (8) and quick-tip mode (9)
4. Real-device and screen-reader QA (11), then a pilot with one real program
