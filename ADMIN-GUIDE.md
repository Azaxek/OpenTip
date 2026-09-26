# Administrator guide

For program coordinators, school administrators and tip-line supervisors. No technical knowledge needed.

> **Operational requirement, not a software feature: 24/7 coverage.** OpenTip can alert people instantly. It cannot make sure someone answers. Decide who is on call, when, and what happens if they don't respond, and write it in [ESCALATION-PROTOCOL.md](ESCALATION-PROTOCOL.md). Until that is done and staffed, do not promote the tip line as monitored. The form always tells the public: *“If this is an emergency… call 911 now. This form is not monitored in real time.”* That notice cannot be turned off and should never be worded to suggest otherwise.

## 1. The big picture

1. Someone submits a tip. They pick a passcode and receive a **TIP ID**. They never give their name.
2. The tip lands in the **Queue**. Urgent and high-risk tips are pinned to the top in red.
3. A reviewer opens it, replies in the **anonymous chat**, adds private notes, and routes or assigns it.
4. The reviewer closes it with a reason (Actioned, Unfounded, Referred, Other).
5. Old tips are deleted automatically after your retention period.

## 2. Signing in and roles

* **Administrator:** everything, including Settings, Analytics, Materials and the Audit log.
* **Reviewer:** the Queue, tips, chat, notes, and Rewards. Sees only tips routed to their team(s) or assigned to them, unless given **See all tips**.
* Change your own password under your name (top right). Use a long, unique password. Deactivate people who leave (Settings → People): they are signed out immediately.

## 3. Working the queue

* **Red URGENT badge:** the tipster said it is urgent, or the category is high-risk (for example self-harm, weapons, abuse), or someone flagged it.
* **Awaiting reply:** the tipster wrote last and is waiting for you.
* Filters: status, category, location, team, assignee, urgent only. Sort: urgent first, newest, oldest.

### Inside a tip
* **Description and Evidence.** Photos, video, audio and PDFs open inline. Metadata was removed when they were uploaded.
* **Anonymous chat.** The tipster sees your replies live and their notification (if they turned it on) says only “You have an update on your tip”. Your name is never shown to them. **Insert canned response…** drops in a saved reply.
* **Internal notes** are for staff only; the tipster never sees them.
* **Status:** Under review / Actioned. **Flag urgent** if you judge it more serious than the tipster did.
* **Assignment & routing:** assign a person; choose which teams can see the tip.
* **Close this tip:** a reason is required. A closure note is optional.
* Do not try to work out who the tipster is. If a conversation makes you suspect someone could be in danger, escalate.

## 4. Escalation: the “Escalate now” button

Use it when a human needs to be alerted immediately. It emails your on-call people and posts to your Slack/Discord channel **at the same time**, records who pressed it and when, and tells you which channels worked.

* If it says **NO alert was delivered**, treat that as an emergency of its own: phone your on-call contact directly.
* Alerts contain the TIP ID, the category and a link, never the tip's text.
* Escalation does not call 911 or handle the situation. It gets a person's attention. Your protocol decides what that person does.

Set it up under Settings → *Escalation* and People → *On call*. Then press **Send a test alert** (Settings, right-hand side). It sends a clearly-labelled test through every channel you configured and tells you, channel by channel, whether it got through. Do this after every change to on-call staff, and at least monthly.

## 5. Teams and routing

Settings → Categories, locations & teams.

* Each category can send tips to one or more teams (the defaults send everything to a catch-all team plus specialists, for example self-harm → Counseling + Administration).
* For districts, a team can be limited to certain locations (“Lincoln High counseling only sees Lincoln High tips”). Tick no locations for all.
* Put staff on teams under People. Deleting a team means tips routed only to it become visible to admins and “see all tips” staff only.

### What tipsters read after they submit

Settings → *What tipsters read after they submit* has two boxes:

* **What to expect:** shown above the chat. Say plainly when a person reads tips (for example “We read tips weekdays 8am to 4pm”). The default says the line is not monitored in real time. Never promise more coverage than you have.
* **Help resources:** shown on the receipt and the status page as “Need help right now?”. Crisis lines, victim assistance, local numbers. The defaults are US examples; replace them with resources for your area.

## 6. Categories, locations and canned responses

* **Categories** are what the tipster picks. Edit the wording, order, and whether each is *high-risk* (pinned, escalatable) or *shown to tipsters*. Categories are hidden, not deleted, once used.
* **Locations** are schools/precincts. For schools you can import a list from your student information system as a CSV with two columns, `external_id,name`. Files with any other column, such as student data, are refused on purpose.
* **Canned responses** are one-click replies. The defaults include US crisis and abuse hotlines: **check and replace these with your local resources.** OpenTip does not provide counseling or crisis triage; it routes reports to trained people.

## 7. Rewards

1. In a tip, enter an amount (up to your maximum) and **Mark eligible**. The tipster is notified.
2. The tipster signs in and taps **Show my claim code**. It appears **once** (it is stored only in scrambled form). Lost it? Press **Reissue claim code** and ask them to check again.
3. When they come to claim, open **Rewards**, enter their TIP ID and code, and **Verify & mark claimed**. Five wrong codes lock that tip for 15 minutes.
4. Pay them however your program normally pays (cash, gift card…). Payment is outside this app.

## 8. Analytics

Analytics shows volume, categories, closure reasons, response and closure times, and rewards paid, for any date range/location/category. Export CSV or PDF for boards and funders. It contains totals only, nothing about individual tipsters, and every export is logged.

## 9. Materials

Materials creates a printable poster with a QR code, a QR image, and a parent/community letter you can edit before downloading. If the QR points to the wrong address, your `APP_URL` setting needs fixing (ask whoever deployed the site).

## 10. Retention and the privacy notice

Settings → Retention: tips with no activity for the chosen number of days are permanently deleted, including files. Enter your database provider's backup window too; the public privacy page shows both. If you must keep a tip longer for legal reasons, export what you need and ask your technical contact to pause the purge (see SECURITY.md).

## 11. Health checklist

Settings shows a **Server checklist**. Anything red must be fixed before launch; amber items are optional features. A yellow bar across the console means something critical is missing.

## 12. Launch checklist

- [ ] ESCALATION-PROTOCOL.md completed; on-call people named and marked *On call*
- [ ] Escalation tested: alert received on every channel
- [ ] Categories, teams and locations reviewed; canned responses use local resources
- [ ] Reviewers created, on the right teams, using their own passwords
- [ ] Privacy notice and retention period approved by your legal counsel
- [ ] Poster/letter reviewed; staff briefed on the “do not try to identify tipsters” rule

## 13. What to tell tipsters

* “Save your TIP ID and passcode. We can't recover them.”
* “We don't record your name, phone, email, IP address or device.”
* “Be careful what you write or photograph: details themselves can identify you.”
* “In an emergency call 911. This form is not watched in real time.”
* “If someone might see your screen, press **Quick exit** (or Esc twice): it clears this tab and opens a weather site.”
