# Performance & Growth cycle: feedback review against the codebase

Date: 29 September 2026
Source: brain-dump notes plus the Granola "Enhanced Summary" from the manager feedback session.
Scope: every note mapped to what the app does today (file references are to `src/`), with a concrete proposal and a rough size (S = under a day, M = 1 to 3 days, L = a week or more).

The list is in three parts: bugs found while reading the code (fix first), the improvements from the notes, and a suggested order of work.

---

## Part 1. Bugs found while reviewing (fix before the next cycle)

These were not in the notes but explain some of the feedback ("metrics didn't load", "what period is this for") and two of them leak ratings.

| # | Problem | Where | Why it matters |
|---|---------|-------|----------------|
| B1 | **Any employee can read every manager assessment in the company.** The list endpoint only restricts `managerId` for MANAGER and AREA_LEAD roles. An EMPLOYEE session hitting `/api/assessments/manager?cycleId=…` gets every rating, evidence text and note for everyone. | `app/api/assessments/manager/route.ts` GET, the role check before `findMany` | Data leak. One-line fix: EMPLOYEE gets `where.employeeId = session.user.id` plus `resultsSentAt: { not: null }`, or a 403. |
| B2 | **Employee dashboard shows manager ratings before results are shared.** The summary card picks the latest cycle where the manager *submitted*, not where results were *sent*, and the summary API returns the full manager assessment to the employee regardless of `resultsSentAt`. | `app/(app)/dashboard/page.tsx:99` (`mgrSubmitted`), `app/api/assessments/summary/route.ts` (`mgrData`) | Employee sees scores the manager has not shared yet. The "Manager Assessment: Submitted" badge on the same card leaks timing too. My Reviews page does gate on `resultsSentAt`, the dashboard does not. |
| B3 | **"What period is this for?"** The employee summary card only prints "Latest: {month}" when there is more than one completed cycle. With one cycle the four numbers have no period label at all. | `dashboard/page.tsx:168-172` | Direct answer to the note. Always print the period, and gate on results sent (B2). |
| B4 | **Goals & Key Metrics panel silently vanishes.** The panel returns `null` while loading, when both lists are empty, and on *any* fetch error (the catch only clears `loading`; if the goals call returns an error object, `.filter` throws and the panel disappears). It is also collapsed by default. | `components/assessments/goals-panel.tsx:27-41` | Almost certainly the "metrics didn't load due to bugs" report. Show an explicit empty/error state and expand by default. |
| B5 | **Manager dashboard is bound to the most recent cycle, not the open one**, and the assess form swallows API errors. If an admin has created next month's cycle or the latest is closed, "Assess" opens a form whose save fails with "Cycle is not open" and the user sees nothing. The Team page picks the open cycle first; the dashboard does not. | `dashboard/page.tsx:317` (`cycles[0]`), `team/page.tsx:40`, `assess/[employeeId]/page.tsx` `save()` has no `res.ok` check | Contributes to low completion: a manager clicks Assess, nothing saves, gives up. |
| B6 | **Submit has no validation.** A manager or employee can submit with ratings blank. Analysis and the 9-box then silently drop the record while Team shows "Done". | `components/assessments/step-form.tsx`, filters in `calibration/page.tsx:39` and `dashboard/page.tsx:335` | Incomplete "done" assessments distort completion and the grid. Require all ratings before Submit and show which are missing. |
| B7 | **"Locked once submitted" is UI only, and the API accepts any field.** The POST route spreads the request body into the upsert, so a client can set `submittedAt`, `resultsSentAt`, `oneOnOneComplete` directly. The PUT route passes the body straight to `update` with no cycle-open or submitted check. Same pattern on the self-assessment routes. | `app/api/assessments/manager/route.ts` POST, `app/api/assessments/manager/[id]/route.ts` PUT, `app/api/assessments/self/*` | Needs fixing before adding edit-after-submit and an audit log (Part 2, A), otherwise the log can be bypassed. Whitelist fields server-side. |
| B8 | Small: the send-results route includes `selfAssessments: { where: { cycleId: undefined } }` (a no-op that loads every self-assessment for the employee); self-assessment prefill copies *last month's* achievements and blockers into the new draft, which encourages stale text in exactly the sections the notes say need to read clearly. | `app/api/assessments/manager/send-results/route.ts`, `app/api/assessments/self/route.ts` prefill block | Drop the include; prefill only forward-looking text (last month's "goals for next month" becomes this month's context), not achievements/blockers. |

---

## Part 2. Improvements from the notes

### Now: the review flow

#### A. Edit ratings after submission, with an audit log (from the meeting summary)

*Today:* Save Draft and Submit are disabled once `submittedAt` is set (`step-form.tsx`). There is no revision history anywhere in the schema.

*Proposal:*
- Add an `AssessmentRevision` table: `managerAssessmentId`, `changedById`, `changedAt`, `reason`, `before` (JSON snapshot), `after` (JSON snapshot). Write one row on every post-submit save, inside the same transaction.
- Allow editing while the cycle is OPEN. After results are shared (see I), require a reason and notify the employee; leadership can decide whether to block edits after the 1:1 is marked complete.
- Enforce server-side (fixes B7 at the same time): reject writes when the cycle is CLOSED, whitelist editable fields, never accept `submittedAt`/`resultsSentAt` from the client.
- Summary and meeting view show "Edited 2 times, last by {name} on {date}" with an expandable diff for the manager and leadership.
- Analysis gets an "edited after self-review submitted" count per manager (the passive-manager signal the summary asks for, see K).

Size: M.

#### B. Show the employee's self-review inside the manager form

*Today:* the manager fills their form blind. The self-review is only visible on the Summary page after both are submitted, which is why "seeing the employee's feedback changed the manager's perspective" only happened after the fact.

*Proposal:* on each manager step, render the matching self rating and text in a side panel ("{Name} rated themselves Meeting and said: …"). The summary API already returns the self-assessment to the manager, so this is UI only. Add a banner when the self-review is not yet submitted so the manager can choose to wait. This removes most of the reason to edit after submission.

Size: S.

#### C. Metrics during the review, and results recorded against metrics

*Today:* `KeyMetric` has name, target, unit, notes. No actuals, nothing per cycle. In the forms the metrics sit in the collapsed panel from B4.

*Proposal:* the two-step flow from the summary.
1. New `KeyMetricResult` table: `keyMetricId`, `cycleId`, `actual`, `achieved` (bool), `note`, `recordedById`. Employee or manager records results for the cycle from a "Record results" step that opens the assessment (or from the profile page).
2. The Performance rating step shows a metrics table inline (target, actual, hit/miss) above the rating buttons, not behind a collapsed panel.
3. A "rating vs results" check: performance rated Meeting or above while most metrics were missed shows a warning on the step and on the summary, and Analysis lists these "rating/metric disconnects" for leadership. That is the "lenient management or wrong goal-setting" flag from the summary, and the concrete coaching list.

Size: M to L (schema, two forms, summary, analysis).

#### D. Single-page form with a toggle

*Today:* one question per screen, 12 steps for managers and 14 for employees (`step-form.tsx`). Progress is step index, not answered questions.

*Proposal:* add a `mode` to StepForm: "step by step" or "single page". Single page renders every step as a section with a sticky Save/Submit bar and a jump-to-section list. Remember the choice per user (localStorage is enough). Progress becomes answered-of-required in both modes, and Submit is blocked until required ratings are set (B6).

Size: S to M.

#### E. Mirror the questions so each section reads clearly

*Today the two forms diverge:*

| Section | Self-assessment asks | Manager asks | Gap |
|---------|---------------------|--------------|-----|
| Performance | rating, justification, achievements, blockers, learning | rating, evidence | Manager never responds to achievements or blockers; summary lumps them under "Performance". |
| Growth | nothing | rating, evidence | No self view (see F). |
| Values | 4 ratings, one reflection | 4 ratings, one evidence text | Aligned. |
| Engagement | rating, driver, support needed | rating, evidence | Manager never answers "support needed". |
| Looking ahead | goals for next month (free text) | additional notes | Free text is disconnected from Goal records (see G). |

*Proposal:* one shared section config (extend `lib/assessment-prompts.ts` into `lib/assessment-sections.ts`) that both forms, the comparison component and the meeting view render from, so they cannot drift again. Five sections, same titles and order on both sides:
1. **Performance**: rating + evidence, then "Key achievements" and "Blockers" as their own labelled questions on both sides (manager: "Achievements you observed", "Blockers you can remove").
2. **Growth**: rating + evidence on both sides.
3. **Values**: four ratings + evidence.
4. **Engagement**: rating, then "What's driving it" / "Support needed" (employee) mirrored by "Support I'll provide" (manager).
5. **Looking ahead**: goals (structured, see G) and status on last month's goals.

Size: M (touches both forms, comparison, summary, my-reviews).

#### F. Growth assessment for employees too

Add `growthReadiness Int?` and `growthReadinessReflection String?` to `SelfAssessment`, self prompts for growth in the prompts file (currently manager-only), and show the self column in the comparison (both `summary` and `my-reviews` hard-code `selfRating: null` for growth).

Size: S. Do it as part of E.

#### G. Make goals more obvious

*Today:* goals live on the employee profile (`/team/[id]`), only managers can create them, the in-form panel is collapsed and hidden when empty, and the self-review's "goals for next month" is free text with no link to `Goal` rows.

*Proposal:*
- Goals section always visible and expanded at the top of both forms, with "Add goal" inline for managers.
- Employees can *propose* goals in section 5; the manager accepts or edits them in the meeting, which creates `Goal` rows (open the POST route to employees with a `proposed` status, or a `proposedById` field).
- Section 5 also asks for a status update on each active goal (Done / On track / Off track + note), stored per cycle.
- Goals and their status appear on the summary and meeting view.

Size: M.

#### H. Meeting mode: notes and actions in one view

*Today:* the Summary page is scores, placements with a one-line action, a comparison list that is collapsed per dimension, additional context, manager notes, then a notes textarea at the bottom that only saves when you press "Save Meeting Notes" (which also flips `oneOnOneComplete`). Goals and metrics are not on the page at all.

*Proposal:* a "Meeting mode" toggle on the summary (or `/meeting/[employeeId]?cycleId=`) laid out as an agenda:
1. Metrics and results for the cycle (from C).
2. Section-by-section comparison, expanded by default, in the shared section order from E.
3. Prescribed actions from both boxes, plus an editable "Agreed actions" checklist persisted on the assessment (each can be promoted to a Goal).
4. Meeting notes with autosave (separate from completion).
5. A distinct "Mark 1:1 complete" button.

Decide whether meeting notes are visible to the employee after the meeting. Today they are hidden (the summary API nulls `oneOnOneNotes` for anyone but the manager). Given the "share in advance" direction, I would default to visible and keep a separate "manager-only note" field if one is needed.

Size: M.

#### I. Change the workflow to share in advance

*Today:* the employee sees nothing until the manager presses "Send Results", the modal instructs managers to only send *after* the 1:1, and the action "cannot be undone".

*Proposal:* replace the single `resultsSentAt` gate with stages on `ManagerAssessment`: `sharedAt` (shared before the meeting so the employee can prepare), `oneOnOneCompletedAt` (exists), `finalisedAt` (optional, after the meeting when agreed actions are set). Badges on Team, Dashboard and the admin cycle table become Draft → Submitted → Shared → Meeting done. Remove the "only after the 1:1" warning. Edits after `sharedAt` write a revision (A) and notify the employee (N).

Size: S to M (mostly renaming and status logic; pairs naturally with A and H).

### Soon: analysis and admin

#### J. Percentage analysis on the Grid view

*Today:* grid cells list names with no counts. `computeInsights` in `calibration/page.tsx` already computes `topTalent` (Ready to Promote, Stretch & Develop, Expand the Role), `atRisk` and `intervene`.

*Proposal:*
- Each cell header shows `n (xx%)` of the filtered population; a Names / Counts / Heatmap toggle.
- A tier bar under the grid: Top, Medium, Low with counts and percentages. Suggested mapping for Talent Density, to confirm: Top = Ready to Promote, Stretch & Develop, Expand the Role; Medium = Keep Growing, Deepen the Expertise, Remove the Blockers; Low = Intervene Now, Build the Foundations, Maintain & Recognise. Same idea for Cultural Momentum.
- Tier shift added to the month-over-month table.

Size: S.

#### K. "Reports to" on the Analysis tab

The manager assessments API already returns `manager: { id, name }`. Add a "Manager" multi-select beside Titles and Teams, a "Reports to" column in the movement table and prescribed actions, and a per-manager rollup card: headcount, average Talent Density and Cultural Momentum, % top talent, completion rate, edits after submission (A), rating/metric disconnects (C). That rollup is the manager accountability view from the meeting summary.

Size: S for filter and column, M with the rollup.

#### L. Filtering in user management

`admin/users/page.tsx` renders a flat list. Add a search box (name, email), filters for role, team, manager and active status, a sort, and a result count. All client-side over the existing `/api/admin/users` payload. Consider a table layout so the inline edit controls line up.

Size: S.

#### M. Assess button on the dashboard, and the cycle on a board

*Today:* the manager dashboard roster already has an Assess button, but it is bound to the most recent cycle rather than the open one (B5) and there is no cycle selector (the Assess Team page has one). Nothing in the app is a kanban today.

*Proposal:*
- Dashboard: cycle selector defaulting to the open cycle, Assess as the primary call to action per person, and the send/share action alongside.
- Board view: a stage board on the manager dashboard (and on the admin cycle detail) with columns Not started / Self-review in / Manager review in / Shared / Meeting done. Cards are team members with Assess, Share and Meeting buttons. Stages come from `/api/team` plus the new fields in I.

Assumption: "assessment cycle on the kanban" means a per-cycle stage board like this. If you meant something else (for example a board of cycles for admins), say so and I will re-scope.

Size: S for the button and selector, M for the board.

### Adoption: notifications and reminders

#### N. Email notifications, reminders and a calendar link

*Today:* Resend is wired up but only sends invitation emails (`lib/email.ts`). Cycles have no due dates. There is no scheduler.

*Proposal:*
- Add `selfDueAt` and `managerDueAt` to `AssessmentCycle`, set when the admin creates the cycle.
- Event emails, reusing the invite template: cycle opened (everyone), self-review submitted (to the manager), review shared (to the employee, with a link to prepare), meeting completed (summary to both).
- Reminder emails: Sunday and Monday 8am as in the notes, to anyone whose step is not submitted, with escalation to the manager's manager after the due date. Needs a scheduler: a `vercel.json` cron hitting `/api/cron/reminders` protected by a `CRON_SECRET`, and a small `NotificationLog` table so a re-run never double-sends.
- Calendar link: the "review shared" email carries an `.ics` attachment or a Google Calendar template link for the 1:1, and the meeting view gets a "Schedule 1:1" button that opens the same link pre-filled with title and agenda.

Size: M.

### Future

#### O. Trigger 360 feedback

New tables `FeedbackRequest` (`employeeId`, `cycleId`, `requestedById`, `reviewerId` or external email, `token`, `status`) and `PeerFeedback` (values ratings, strengths, growth areas). The manager or employee triggers requests from the meeting view or profile; the reviewer gets a tokenised email using the invite email pattern and a short form. Results aggregate on the summary, anonymised below three responses. Depends on N for the notification.

Size: L.

---

## Part 3. Notes I did not turn into items

- "No private notes." is the Granola export's boilerplate (the meeting had no private notes), not a feedback item. If it was in fact a request for meeting notes to be visible to employees, it is covered under H.
- The `[[Date/2026-06-25 10:25]]` line is a Capacities date link and was ignored.

---

## Suggested order

1. **Bugs B1, B2, B5, B6, B7** (half a day to a day). B1 and B2 are leaks and should ship first.
2. **B, F, E, D**: show the self-review in the manager form, add growth to the self form, mirror the sections, add the single-page toggle. One shared section config drives all of it.
3. **A, I, H**: edit after submit with audit log, share-in-advance stages, meeting mode. These three share the same status fields and should be designed together.
4. **C**: metric results and the rating/metric check.
5. **J, K, L, M**: analysis percentages, reports-to, admin filtering, dashboard assess button and board.
6. **N** then **O**: reminders and calendar links, then 360 feedback.

Steps 2 and 3 are what the meeting summary called "positive change once bugs resolved"; step 4 is what makes the manager accountability story real.
