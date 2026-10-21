# Gap review against `main` (29 September 2026)

> Status, 20 October 2026: the Vercel GitHub link was restored after it stopped receiving pushes between 18 August and 29 September. The repository remains at `Richie-Rick/9-box`; no transfer is needed. Decisions D1 to D5 are still open.

This replaces the earlier review that was done against the stale `claude/9-box-assessment-app-HG8Sj` branch. Everything below was checked by reading `main` at commit `14e68bf`. File paths are under `src/`.

**What `main` already has** (June to August work): quarterly cycles with computed close-out dates; a Kanban meeting pipeline (In Assessment, Ready to Meet, Meeting Scheduled, Meeting Complete, Review Complete) with drag, override and an Assess button on every card; a meeting page with notes and actions-as-tasks; tasks, PIPs, review notes, password reset; unlock-and-edit after submission with an audit log and leadership write path; goal progress and metric results per cycle, with the manager's Performance step gated until every metric has an actual; employees can set their own goals and metrics; a new UI shell and design system.

Sizes: S under a day, M one to three days, L a week or more.

---

## 1. Bugs on `main` (fix first)

| # | Problem | Where on `main` | Fix |
|---|---------|-----------------|-----|
| B1 | **Any employee can list every manager assessment.** The role filter only restricts MANAGER and AREA_LEAD; an EMPLOYEE session gets every row with ratings, evidence and notes. | `app/api/assessments/manager/route.ts` lines 23 to 26 | Add an EMPLOYEE branch: `employeeId = session.user.id` and `resultsSentAt` (or the new `sharedAt`) not null. S |
| B2 | **Employees see unshared manager ratings.** The summary API returns the full manager assessment to the employee regardless of `resultsSentAt`; the dashboard summary card then keys off `mgrSubmitted`, so scores show before results are sent. My Reviews gates in the UI only. | `app/api/assessments/summary/route.ts` lines 66 to 71; `components/assessments/personal-cycles.tsx` line 100 | Strip ratings and text for the employee until shared; use `resultsSent` in the card. S |
| B3 | **Employees cannot save goal progress from their self-assessment.** The self form renders the goals panel editable, but its Save calls `POST /api/goals/progress`, which requires `isManager`, so employees get "Forbidden". | `app/(app)/self-assessment/page.tsx` line 123; `app/api/goals/progress/route.ts` line 15 | Allow the goal's owner to post progress. Decide whether the update is shared (one per goal per cycle, current unique key) or per author. S |
| B4 | **Submit with blank ratings is accepted.** No client or server validation; Analysis then silently drops the record while the board shows "Mgr done". | `components/assessments/step-form.tsx`; both assessment POST routes | Required-rating check on the last step and a 400 on submit with missing ratings. S |
| B5 | **Goals and metrics panel disappears on empty or error.** Fetch errors are coerced to `[]` and the panel returns `null`. Likely the "metrics didn't load" report. | `components/assessments/goals-panel.tsx` lines 100 to 130 | Explicit loading, error and empty states; open by default on summary and My Reviews. S |
| B6 | Any manager can read and add goals and metrics for any employee, not only their reports. | `app/api/goals/route.ts` line 21 and 56; `app/api/key-metrics/route.ts` same | Use `canManageEmployee` (already in `lib/permissions.ts`). S |
| B7 | Self-assessment prefill copies last quarter's achievements, blockers and learning into the new draft; the send-results route carries a no-op include. | `app/api/assessments/self/route.ts` lines 44 to 57; `app/api/assessments/manager/send-results/route.ts` lines 21 to 32 | Show last quarter's goals as read-only context only; drop the include. S |

---

## 2. Feedback items, status on `main`, and the exact work

### Done on `main`, nothing to build

- **Assess button on the dashboard and the Kanban** (`components/meetings/kanban-board.tsx` lines 185 to 200; cycle picker on the dashboard and `/team/cycles`).
- **Edit ratings after submission with an audit trail** (`api/assessments/manager/unlock`, `lib/audit.ts`, audit trail on the summary; employees see their own self-assessment history on My Reviews).
- **Metrics during the review, two-step flow** (metric results per cycle, Performance step blocked until all actuals are recorded, `assess/[employeeId]/page.tsx` lines 125 to 143).
- **Manager sets goals and metrics per team member** (`team/[employeeId]`), and employees set their own (`/goals`).
- **Employee dashboard period label** ("Current cycle: Q3 2026" in `personal-cycles.tsx` line 181). The leak in B2 remains.
- **Meeting view with notes and actions** (`/meeting/[assessmentId]`, `components/meetings/meeting-editor.tsx`). See item 2.1 for what it lacks.

### Partially there

**2.1 Update meeting mode** (notes: "Meeting view, show notes and the actions", "Update meeting mode"). The meeting page is notes plus actions only; the manager has to open the summary in another tab to see ratings, comparison, goals and metrics.
- Extend `app/(app)/meeting/[assessmentId]/page.tsx` to fetch `/api/assessments/summary` and render, above the editor: goals and metric results (existing `GoalsPanel` read-only, open), the self-versus-manager comparison expanded, the two 9-box placements with prescribed actions, then the existing notes and actions. Print stylesheet. **S to M.**

**2.2 Mirror the questions; sections read clearly** (notes: "Blockers and achievements", "Ensure each section reads clearly"). `main` already folds evidence into a comments box per rating and mirrors the Performance-step panels. Still missing: the self form has no growth readiness; the manager has no counterpart to achievements, blockers or support needed; the comparison is hand-built in two pages and shows no self column for growth.
- New `lib/assessment-sections.ts` (five sections: Performance, Growth, Values, Engagement, Looking ahead) that both forms and the comparison render from; `assessment-prompts.ts` folds into it.
- Schema: `SelfAssessment.growthReadiness Int?`, `growthReflection String?`; `ManagerAssessment.achievementsObserved`, `blockersToRemove`, `supportCommitted String?`. Migration `0018`.
- `assessment-fields.ts` whitelists derive from the config. `summary/[employeeId]/page.tsx` and `my-reviews/page.tsx` build rows from it (growth gets a self column). **M.**

**2.3 Single view when completing the form, with a toggle.** `step-form.tsx` is one step at a time only.
- Add a layout toggle (one at a time / all on one page) stored in localStorage; single-page mode stacks every step as a card with a sticky save bar; both modes get answered-of-required progress and the B4 validation. `blockNext` (metrics gate) becomes a banner in single-page mode. **S to M.**

**2.4 Goals and metrics more obvious** (notes: "Move goals to be more obvious"; new request: clearer on the employee dashboard). The panel is open on the employee dashboard but hidden when empty or on error, collapsed elsewhere.
- Always-visible card on the employee dashboard with an empty state and a link to `/goals`; open by default on summary and My Reviews; fixes from B5. **S.**

**2.5 Manager accountability signals** (meeting summary: identify passive managers, rating versus results). The audit log exists but nothing rolls it up, and metric results have no hit or miss flag so a rating-versus-results check is impossible.
- Schema: `MetricResult.achieved Boolean?`; Hit / Missed toggle in `goals-panel.tsx` `MetricRow`. Migration `0018` (same file as 2.2).
- Warning on the Performance rating when the rating is Meeting or above and more metrics were missed than hit; the same on the summary.
- Analysis (`calibration/page.tsx`): "Rating vs results" list and a per-manager rollup (submitted of total, averages, % top tier, edits after submission from `AuditLog`, disconnects). Needs `GET /api/assessments/manager` to include drafts for leadership. **M.**

### Missing

**2.6 Share the review before the meeting** (notes: "Change workflow to share in advance"). On `main`, "Send Results" is the closing step: it happens after Meeting Complete, moves the card to Review Complete and locks the assessment. The employee sees nothing before that. The Kanban and admin stats are built around it.
- Keep Send Results as the close-out. Add a separate **share** step: `ManagerAssessment.sharedAt`, `POST /api/assessments/manager/share` (manager submitted; self-assessment not required, with a warning), a "Share review" action on Ready to Meet and Meeting Scheduled cards and on the summary, and a Shared chip on the card.
- The summary API returns ratings and comments to the employee once `sharedAt` is set (meeting notes stay until Meeting Complete, per decision D3). My Reviews and the dashboard card gate on `sharedAt` instead of `resultsSentAt`.
- Edits after sharing require a short reason, stored in the audit `summary`; the employee's My Reviews shows "Updated since shared". **M.** Decision D1.

**2.7 Rate blind, then reveal and respond.** The manager form never shows the self-assessment; the two are only compared afterwards on the summary.
- Schema: `ManagerAssessment.responsePerformance`, `responseGrowth`, `responseValues`, `responseEngagement String?`, `initialRatings Json?`.
- `GET /api/assessments/self-for-review?cycleId&employeeId&section`: returns the employee's answers for a section only after the manager's rating for it is saved, snapshotting the initial rating on first reveal.
- Each manager step gets a "Show what {name} said" panel and a response box once rated; responses stay editable after submission; the summary shows initial versus final where they differ. **M.** (Requires 2.2 for the section definition.)

**2.8 Role-level metrics and goals set by the admin** (new request). Job title is free text; nothing is role-scoped.
- Schema: `JobRole` (seeded from distinct job titles), `User.jobRoleId`, `MetricTemplate`, `GoalTemplate`, `Goal.templateId`; `MetricResult` gains `employeeId` and `metricTemplateId?` with a second unique key so role metrics can hold per-person results. Migration `0019`.
- `lib/job-roles.ts`: resolve a role by name at registration, invitation and import; virtual role metrics merged into `GET /api/key-metrics`; goal templates materialised per person on create and on role change, cancelled on deactivate.
- `app/(app)/admin/roles/page.tsx` plus `api/admin/roles` and `api/admin/roles/templates`; job role select on user management; "Role-set" badge in `goals-panel.tsx`, `/goals`, the profile and the summary. **M to L.**

**2.9 Analysis: box percentages, tiers, reports to** (notes: "% analysis for the Grid view", "How many are low, medium and top talent", "Add 'reports to'"). Only a Top Talent count exists; the manager is in the payload but unused.
- Per-cell "n (xx%)", a Names / Counts / Heatmap toggle, `BOX1_TIERS` and `BOX2_TIERS` in `lib/nine-box.ts` with a tier bar and a Tier column in the movement table.
- Manager multi-select beside Titles, Teams and Tenure; "Reports to" in the movement table and prescribed actions. **S.** Decision D5.

**2.10 Filtering in user management.** None today (`admin/users/page.tsx` renders the whole list).
- Search by name or email, filters for access role, team, manager and status, sort, count; filters in the URL. **S.**

**2.11 Email notifications, calendar reminders** (meeting summary: low completion, Sunday or Monday 8am pings; notes: calendar link). `main` sends invite and password-reset emails only. Due dates are computed, not stored: Ready to Meet by the 10th, Meeting Complete by the 20th, Results by the 25th of the month after the quarter (Q2 one month later), in `lib/utils.ts` `getCycleDueDates`.
- `lib/notifications.ts` with a `NotificationLog` table (user, type, ref) so nothing sends twice; events: cycle opened, self submitted, review shared (2.6), review updated after sharing, meeting complete.
- `api/cron/reminders`: Sunday and Monday mornings in `REMINDER_TIMEZONE`, one reminder per person per kind per day, using the computed milestones (submissions are chased against the Ready to Meet date), escalation to the manager's manager three days after a milestone; admin "Send reminders now". Add a `crons` entry to the existing `vercel.json` (it already carries the custom build command). Migration `0020`.
- Google Calendar template link and `.ics` download on the meeting page and in the share email. **M.**

**2.12 360 feedback.** Nothing on `main`. Tokenised reviewer requests, a public form, anonymised aggregation. **L, later.**

---

## 3. Decisions needed before the port starts

- **D1 Share step.** Add "share" as a separate step before the meeting and keep Send Results as the close-out (recommended), or replace Send Results with share. The Kanban's Review Complete column and admin stats depend on the answer.
- **D2 Cadence.** The code is quarterly; the feedback notes say monthly. Reminders and due dates will be built for quarterly unless told otherwise.
- **D3 Meeting notes visibility.** Today the employee never sees `Meeting.notes` (review notes and tasks are visible). Recommended: visible once the meeting is marked complete.
- **D4 Goal progress authorship.** One shared update per goal per cycle (current unique key, so employee and manager overwrite each other) or one per author. Recommended: per author, shown side by side.
- **D5 Talent tier mapping.** Top: Ready to Promote, Stretch & Develop, Expand the Role. Medium: Keep Growing, Deepen the Expertise, Remove the Blockers. Low: Intervene Now, Build the Foundations, Maintain & Recognise. Same idea for Cultural Momentum.

---

## 4. Suggested order

1. **Bugs B1 to B7** (about a day). B1 and B2 are leaks and should go to production on their own.
2. **2.2, 2.3, 2.4, B4** forms and goals (about a week): the shared section config, growth for employees, single-page toggle, validation, goals card.
3. **2.6, 2.7, 2.1** workflow (about a week): share step, reveal and respond, richer meeting page.
4. **2.5, 2.9, 2.10** analysis and admin (three to four days).
5. **2.8** role templates (three to five days).
6. **2.11** notifications and calendar (about a week). Then 2.12.

Each phase lands as its own commit on a branch cut from `main`, with `tsc`, `eslint` and `next build` clean, and a Prisma migration numbered after `0017` where the schema changes.
