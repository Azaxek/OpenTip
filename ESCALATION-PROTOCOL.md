# Escalation protocol (template: fill in and adopt)

**This is the one part of “everything commercial tip lines do” that is organizational, not technical.** OpenTip can get an alert to a human in seconds. It cannot guarantee a human reads it, decides well, or acts. This document is how your organization closes that gap. Replace every `[bracketed]` item, have leadership and counsel review it, and keep it where on-call staff can find it in the middle of the night.

Program: **[Organization name]** · Owner: **[name, title]** · Version/date: **[ ]** · Next review: **[date, at least twice a year]**

## 1. Purpose and limits

- The tip line is **not monitored in real time** and is **not a way to summon emergency services.**
- Anyone in immediate danger must call **911** (or **[local emergency number]**). The tip form says so on every page.
- The software's job: alert a person quickly and record that it did. Everything after that is human judgment under this protocol.
- Staff must **never** attempt to identify a tipster.

## 2. What counts as an escalation

Press **Escalate now** (or phone the on-call contact directly) when a tip suggests any of:

- [ ] a person may be about to hurt themselves or someone else (weapons, threats, suicide/self-harm)
- [ ] a child or student is being abused or is in unsafe conditions
- [ ] an ongoing or imminent crime or safety risk at a known place/time
- [ ] the tipster says they are in danger now
- [ ] **[add your own]**

If in doubt, escalate. A false alarm costs minutes; a missed one can cost far more.

> First, if there is imminent danger to anyone, **call 911 yourself, now**, then escalate. Do not wait for chat replies.

## 3. On-call rotation

Every hour of every day needs a named primary and a named backup, including nights, weekends, holidays, and school breaks (or your written decision that coverage is business-hours only, in which case **say that publicly** and remove any implication of monitoring).

| Days / hours | Primary (name, mobile) | Backup (name, mobile) | Channel they watch |
|---|---|---|---|
| Weekdays [hh:mm–hh:mm] | [ ] | [ ] | [email / Slack channel / SMS relay] |
| Weeknights [ ] | [ ] | [ ] | [ ] |
| Weekends [ ] | [ ] | [ ] | [ ] |
| Holidays / breaks [ ] | [ ] | [ ] | [ ] |

- In OpenTip, mark exactly the people currently on call under **Settings → People → On call**. Update it at every handoff. **[Owner of that task]**
- Handoff time and method: **[ ]**
- The escalation email goes to everyone marked on call, and the webhook posts to **[channel name]**. Someone must be actually watching it: **[who / how]**.

## 4. When an escalation arrives

Target response: acknowledge within **[ ] minutes**, first action within **[ ] minutes**.

1. Open the tip in the console (link in the alert). Read the description and any evidence.
2. Decide: **is there imminent danger?** If yes, call **911** and, for schools, follow your crisis/threat-assessment procedure **[link]**. Notify **[people]** per **[policy]**.
3. Reply in the anonymous chat if it helps (a canned response is available). Do **not** promise outcomes. Do **not** ask for identifying information.
4. Add an **internal note** describing what you did and when.
5. Route to the right team(s) (for example Counseling, School Resource Officer, Administration) and **assign** an owner.
6. **Acknowledge** to the rest of the on-call group in **[channel]** so it is not double-handled.
7. Close only when handled, choosing a reason (Actioned, Unfounded, Referred, Other).

## 5. If the alert did not arrive, or nobody acknowledges

- The console tells the person who pressed the button which channels worked. If it says **NO alert was delivered**, they must phone the on-call primary directly, then the backup, then **[supervisor]**.
- If the primary does not acknowledge within **[ ] minutes**, the alert goes to the backup, then **[supervisor]**, then **[executive]**.
- Test the full chain at least **[monthly]** by escalating a test tip during handoff hours and recording who received it, how fast, and any gaps. Log results here: **[link/date]**.

## 6. Scripts and resources

- Canned replies (Settings → Canned responses) contain crisis and abuse-reporting resources. **Owner: [name]; verify each number every [6 months].**
- Local resources to add: **[county crisis line, child protective services hotline, school counselor lines, …]**
- Mandated-reporter obligations: **[policy reference and who files]**. OpenTip does not file reports for you.

## 7. Records

- The audit log (Settings → Audit log) records who escalated, when, and which channels delivered. Keep it for **[ ]** months (Settings → Retention).
- Post-incident review for every escalation that led to action: **[template, owner, timeline]**.

## 8. Public promise

State plainly to the public (poster, website, letters): **[e.g. “Tips are reviewed Monday–Friday 7am–5pm. For emergencies call 911.”]** Do not advertise coverage you do not have.

## 9. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Program owner | | | |
| Legal counsel | | | |
| Superintendent / Chief / Director | | | |
