# Performance & Growth app: action plan

> **Status (29 Sep 2026):** Phases 0 to 5 are built on branch `claude/optimistic-volta-rcv5sg`, one commit per phase. 6.1 (360 feedback) remains open. Decisions taken with the recommended defaults: hybrid review flow (1.3), job-title-based role templates (3.2), meeting notes visible to the employee after the 1:1 (2.3), the proposed tier mapping (4.1), edits after sharing allowed with a reason (2.2).

Date: 29 September 2026
Builds on `docs/feedback-review-2026-09.md` (item codes B1 to B8 and A to O refer to that document) plus the three additions and the proposed flow change from the follow-up discussion.

---

## 1. Critique: self-assessment first, then manager responds and rates

**The proposal.** The employee completes the self-assessment and submits it to the manager. The manager reads it, responds to it, and provides their rating. Today both assessments are written independently and in parallel, and the Summary page compares them afterwards.

**What it gets right.**
- The manager rates with context. The feedback said seeing the self-review "changed the manager's perspective", and today that only happens after both are locked.
- It turns the manager assessment into a reply rather than a parallel monologue, which is the mirrored-questions ask done properly.
- Most of the demand to edit ratings after submission disappears, because the manager already had the information.
- The sequence gives natural deadlines (self by day X, manager by day Y, meeting by day Z) for the reminder emails.

**The costs, honestly.**
1. **Anchoring.** Ratings written after reading the self-rating drift toward it. The gap between self and manager is the most useful signal the app produces (it is the whole point of the comparison view, and the "shocked by honest ratings, better than a surprise PIP" observation). A sequential flow shrinks that gap artificially. It also hides passive managers rather than exposing them: agreeing with a self-rating is the path of least resistance, which is the exact behaviour the system was designed to surface.
2. **Completion gets worse, not better.** Low completion was the biggest adoption problem this cycle. Making the manager wait on each employee means one late self-review stalls the manager, and managers lose the ability to batch their reviews in one sitting. Every blocked step in a monthly cadence costs days.
3. **Gaming.** Employees learn that a confident self-rating pulls the manager's rating up. Conscientious people underrate and get anchored down. Over several cycles that inflates the scale and makes month-over-month trends less trustworthy.
4. **Bypasses are needed anyway.** Leave, new starters, and people who simply do not submit all require a "proceed without self-assessment after the due date" rule. That is a new state, a new reminder path and a new admin override that the parallel model does not need.
5. **The month gets tight.** Self by roughly day 7, manager by day 14, share by day 16, meeting by day 21, all inside a monthly cycle. Slippage anywhere pushes the meeting into the next cycle.
6. **It reorders the whole status model.** Team status badges, the admin cycle table, the board view, reminders and the summary all key off the current parallel states. Not huge, but it touches everything, so it should be decided before the workflow items (A, H, I) are built, not after.

**Recommendation: sequential visibility, independent ratings.**
- Both forms stay startable in parallel. Nothing blocks.
- The manager form is ordered so ratings and evidence come first, blind. Once the manager has entered a rating for a section, the employee's self-rating and text for that section are revealed alongside it, and the manager writes a response ("Manager's response to your comments") and may adjust the rating.
- Any adjustment after reveal is stored as `initialRating` and `finalRating`. The delta is visible on the summary and rolls up per manager in Analysis. What the sequential flow would have hidden becomes a measurable signal instead.
- If the self-review is not yet submitted when the manager reaches a section, the panel says so and the manager can either wait or continue; the response step can be completed later without reopening the ratings.
- This keeps the two things the feedback wanted (context before finalising, a reply to what the employee wrote) and the two things the system needs (an independent rating, no blocking dependency).

If you still prefer the strict sequential flow, the plan below changes in one place (item 2.1): statuses become Self draft → Self submitted → Manager draft → Manager submitted → Shared → Meeting done, with a bypass after the self-review due date. Everything else stands.

---

## 2. The plan

Sizes: S under a day, M one to three days, L a week or more. Order within a phase is the build order.

### Phase 0. Fix now (about two days)

| # | Action | Size |
|---|--------|------|
| 0.1 | B1: restrict the manager-assessment list endpoint for EMPLOYEE sessions. | S |
| 0.2 | B2, B3: summary API strips unshared manager ratings for the employee; employee dashboard keys off results-shared and always prints the period. | S |
| 0.3 | B7: whitelist writable fields on all four assessment routes, reject writes when the cycle is closed, never accept `submittedAt` or `resultsSentAt` from the client. | S |
| 0.4 | B5: manager dashboard defaults to the open cycle, adds a cycle selector, and the assess form surfaces API errors. | S |
| 0.5 | B6: require all ratings before Submit and show what is missing. | S |
| 0.6 | B4, B8: goals and metrics panel gets explicit empty and error states and opens expanded; drop the no-op include in send-results; prefill only forward-looking text. | S |

### Phase 1. Forms, goals and metrics (about a week)

| # | Action | Size |
|---|--------|------|
| 1.1 | E, F: one shared section config (Performance, Growth, Values, Engagement, Looking ahead) that drives both forms, the comparison and the meeting view. Add growth readiness to the self-assessment. Manager gets mirrored questions for achievements, blockers and support. | M |
| 1.2 | D: single-page mode with a toggle, remembered per user; progress is answered-of-required. | S |
| 1.3 | Flow (section 1 recommendation): manager form rates blind per section, then reveals the self-review and takes a response; initial and final ratings stored. | M |
| 1.4 | **New: goals and metrics on the employee dashboard.** A card at the top of the employee dashboard listing active goals (with due dates and status) and key metrics (target, latest result), each labelled Personal or Role-set. Same card reused inside both forms in place of the collapsed panel. | S |
| 1.5 | **New: manager sets goals and metrics per team member.** This already exists on the team member profile page, but only there. Add "Add goal" and "Add metric" inline from the assess form and the meeting view, restrict creation to the employee's own manager (or leadership), and let employees propose goals for the manager to accept (G). | S to M |
| 1.6 | G: goal status update per cycle (Done, On track, Off track, note) in the Looking ahead section; goals shown on summary and meeting view. | S |

### Phase 2. Workflow: share, edit, meet (about a week)

| # | Action | Size |
|---|--------|------|
| 2.1 | I: stages on the manager assessment (`sharedAt`, `oneOnOneCompletedAt`, `finalisedAt`); badges everywhere become Draft → Submitted → Shared → Meeting done; remove the "only after the 1:1" warning. | S to M |
| 2.2 | A: revision table written on every post-submit save; edits allowed while the cycle is open; a reason required after sharing; "edited n times" on the summary with a diff for manager and leadership. | M |
| 2.3 | H: meeting mode on the summary: metrics and results, comparison expanded in section order, prescribed plus agreed actions (promotable to goals), autosaving notes, separate "Mark 1:1 complete". Decide whether notes are visible to the employee (recommended yes). | M |

### Phase 3. Metric results and role-level templates (about a week)

| # | Action | Size |
|---|--------|------|
| 3.1 | C: `KeyMetricResult` per metric per cycle (actual, achieved, note); "Record results" step before the ratings; metrics table inline on the Performance step; rating-versus-results warning on the step, summary and Analysis. | M |
| 3.2 | **New: role-level metrics and goals set by the admin.** Job title is free text today, so first add an admin-managed `JobRole` list and turn the job title field into a select (seeded from existing distinct titles). Then `MetricTemplate` and `GoalTemplate` scoped to a job role (optionally a team). Metrics resolve virtually: an employee's metric list is their personal metrics plus every template matching their role, badged "Role-set", with results recorded against the template per employee per cycle. Goal templates are materialised into a Goal row per matching employee (goals need per-person status and due dates) with a `templateId` and the same badge; new hires and title changes pick them up on save. Admin page: manage roles, templates, and see who each template applies to. | M to L |
| 3.3 | Employee dashboard, forms, summary and Analysis all show Personal and Role-set items distinctly (extends 1.4). | S |

### Phase 4. Analysis and admin (three to four days)

| # | Action | Size |
|---|--------|------|
| 4.1 | J: per-box counts and percentages on the grid, Names / Counts / Heatmap toggle, Top / Medium / Low tier bar (mapping to confirm), tier shift in the movement table. | S |
| 4.2 | K: Manager filter and "Reports to" column on Analysis; per-manager rollup (headcount, averages, % top, completion, rating adjustments after reveal, rating-versus-results disconnects). | M |
| 4.3 | L: search, filters, sort and count on user management; table layout. | S |
| 4.4 | M: stage board (Not started / Self in / Manager in / Shared / Meeting done) on the manager dashboard and admin cycle detail, with Assess, Share and Meeting actions on each card. | M |

### Phase 5. Adoption (about a week)

| # | Action | Size |
|---|--------|------|
| 5.1 | N: self and manager due dates on the cycle; event emails (cycle opened, self submitted, review shared, meeting done) on the existing Resend setup. | S to M |
| 5.2 | N: reminder cron (Vercel cron, secret-protected route, notification log to prevent double sends), Sunday and Monday 8am, escalation after due date. | M |
| 5.3 | N: calendar link or `.ics` for the 1:1 in the share email and a "Schedule 1:1" button in meeting mode. | S |

### Later

| # | Action | Size |
|---|--------|------|
| 6.1 | O: 360 feedback requests with tokenised reviewer links and anonymised aggregation. | L |

---

## 3. Decisions needed before Phase 2

1. **Review flow**: hybrid as recommended (independent ratings, then reveal and respond), or strict sequential.
2. **Role scoping for templates**: by job title via a managed `JobRole` list (recommended), by team, or both.
3. **Meeting notes visibility**: visible to the employee after the meeting (recommended), or manager-only with a separate shared field.
4. **Talent tier mapping** for the Top / Medium / Low bar (proposed mapping in the review document, item J).
5. **Edits after sharing**: allowed with a reason and a notification (recommended), or blocked once the 1:1 is marked complete.
