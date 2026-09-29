# Implementation specification, item by item

Date: 29 September 2026
Companion to `docs/action-plan-2026-09.md`. Each item below is what will actually change: schema, API, screens, behaviour. Approve, change or deny per item number. Paths are under `src/` unless noted. Every phase ends with `npm run lint` and `npx tsc --noEmit` clean, and a Prisma migration where the schema changes.

Conventions used throughout:
- "Manager of X" means `X.managerId === session.user.id`. "Leadership" means role LEADERSHIP or ADMIN.
- New server-side field lists live in one file, `lib/assessment-fields.ts`, so client and server agree.

---

## Phase 0. Fix now

### 0.1 Employee can list every manager assessment (B1)
- `app/api/assessments/manager/route.ts` GET: add a branch for role EMPLOYEE that forces `where.employeeId = session.user.id` and `where.resultsSentAt = { not: null }`, and strips `oneOnOneNotes` from the response. MANAGER and AREA_LEAD keep the existing `managerId` filter. Leadership unchanged.

### 0.2 Unshared manager ratings visible to the employee (B2, B3)
- `app/api/assessments/summary/route.ts`: when the requester is the employee and `managerAssessment.resultsSentAt` is null, return `managerAssessment` as `{ id, submittedAt: null, resultsSentAt: null }` only. No ratings, no text.
- `app/(app)/dashboard/page.tsx` (employee view): the summary card uses the latest cycle with `resultsSent`, averages only over cycles with results sent, and always prints "Showing {Month Year}" under the four numbers. The per-cycle "Manager Assessment" row becomes "Manager review: Shared / Not yet shared" so submission timing is not exposed.

### 0.3 Assessment writes accept any field (B7)
- New `lib/assessment-fields.ts`: `MANAGER_FIELDS`, `SELF_FIELDS` (the editable columns), rating validation (integer 1 to 3 or null), text validation (string, trimmed, max 5000 chars).
- Clients send `submit: true` instead of `submittedAt`. The server sets `submittedAt = now()` on submit; it never reads `submittedAt`, `resultsSentAt`, `oneOnOneComplete` or `oneOnOneCompletedAt` from the body.
- `app/api/assessments/manager/route.ts` POST, `app/api/assessments/manager/[id]/route.ts` PUT, `app/api/assessments/self/route.ts` POST, `app/api/assessments/self/[id]/route.ts` PUT: pick only allowed fields, require the cycle to be OPEN, and reject writes to an already-submitted assessment with 409 "Submitted assessments are locked" (Phase 2.2 relaxes this with revisions).
- `app/(app)/assess/[employeeId]/page.tsx` and `app/(app)/self-assessment/page.tsx`: send `submit: true`.

### 0.4 Manager dashboard bound to the newest cycle; errors swallowed (B5)
- `app/(app)/dashboard/page.tsx` (manager view): load all cycles, default to the OPEN one (else newest), add the same cycle `<select>` the Assess Team page has, refetch team and assessments on change.
- `assess/[employeeId]/page.tsx` and `self-assessment/page.tsx` `save()`: check `res.ok`, keep the error message in state. `components/assessments/step-form.tsx` gets an `error` prop rendered as a red banner above the buttons ("This cycle is closed. Ask your admin to reopen it.").

### 0.5 Submit without ratings (B6)
- `StepConfig` gets `required?: boolean`. Required for managers: performance, growth readiness, the four values, engagement. For employees: performance, the four values, engagement (plus growth after 1.1).
- StepForm: Submit is disabled while any required value is empty and shows "3 ratings still needed: Performance, Growth Readiness, Engagement", each a link that jumps to that step.
- Server: on `submit: true`, return 400 with the list of missing required fields.

### 0.6 Goals panel vanishes; stale prefill; no-op include (B4, B8)
- `components/assessments/goals-panel.tsx`: treat a non-array response as an error, render "Couldn't load goals and metrics. Retry" and "No goals or metrics set yet" states, default to expanded. (Replaced entirely by 1.4, but this is the one-hour fix for the next cycle.)
- `app/api/assessments/manager/send-results/route.ts`: remove the `selfAssessments` include.
- `app/api/assessments/self/route.ts`: stop prefilling achievements, blockers, learning, values reflection, engagement driver and support needed from last month. Return `_previous: { goalsNextMonth }` instead; the self-assessment page shows it as a read-only blue box: "Last month you said your goals for this month were: …".

---

## Phase 1. Forms, goals and metrics

### 1.1 Shared section config, mirrored questions, growth for employees (E, F)
- New `lib/assessment-sections.ts` exporting `SECTIONS`. Each section has `id`, `title`, `intro`, and `questions`. Each question has `id`, `kind` (rating or text), `selfField` and/or `managerField`, per-audience titles, prompts (moved in from `assessment-prompts.ts`, which is deleted), rating labels, and `required`.
- Sections and fields:
  1. **Performance**: rating (self `performance` / manager `performance`); evidence (`performanceJustification` / `performanceEvidence`); achievements (`achievements` / new `achievementsObserved`, "Achievements you observed"); blockers (`blockers` / new `blockersToRemove`, "Blockers you will help remove"); learning (self only, `learning`).
  2. **Growth**: rating (new self `growthReadiness` / manager `growthReadiness`, labels Developing, Building, Ready Now); reflection (new self `growthReflection`, "Where do you want to grow next, and what evidence supports your readiness?" / manager `growthReadinessEvidence`).
  3. **Values**: four ratings on both sides; reflection (`valuesReflection` / `valuesEvidence`).
  4. **Engagement**: rating both; driver (`engagementDriver` / `engagementEvidence`, manager title "What you observe driving their engagement"); support (`supportNeeded` / new `supportCommitted`, "Support you will provide next month").
  5. **Looking ahead**: `goalsNextMonth` (self) / `notes` retitled "Priorities and notes for next month" (manager). Structured goal updates arrive in 1.6.
- Schema (migration 0010): `SelfAssessment` + `growthReadiness Int?`, `growthReflection String?`; `ManagerAssessment` + `achievementsObserved`, `blockersToRemove`, `supportCommitted` (all `String?`).
- Both form pages build their steps from `SECTIONS` (no more hand-written step arrays). `summary/[employeeId]/page.tsx` and `my-reviews/page.tsx` build their comparison sections from `SECTIONS` too, so Growth gets a self column and achievements/blockers become their own rows with both sides shown.
- `lib/assessment-fields.ts` (0.3) is derived from `SECTIONS`.

### 1.2 Single-page mode with toggle (D)
- StepForm gains a header toggle "One question at a time / All on one page", saved in `localStorage["assessment-layout"]`.
- Single page: each section is a card with its questions in order; a sticky bottom bar holds Save Draft, Submit and "8 of 10 required answered"; a left-hand section list jumps between cards.
- Step mode: unchanged flow, plus a breadcrumb "Performance · question 2 of 4" so users know where they are.

### 1.3 Rate blind, then reveal and respond (the recommended flow)
- Schema: `ManagerAssessment` + `responsePerformance`, `responseGrowth`, `responseValues`, `responseEngagement` (`String?`) and `initialRatings Json?` (for example `{ "performance": 2, "growthReadiness": 3 }`).
- New route `GET /api/assessments/self-for-review?cycleId&employeeId&section`: manager of the employee only. Returns the employee's self-assessment answers for that section **only if** the manager's rating(s) for that section are already saved. On the first successful call for a section it copies the manager's current rating(s) for that section into `initialRatings`. So the reveal is enforced server side, not by the client.
- Manager form, per section (both layouts): once the section's rating is saved, a panel "What {name} said" appears showing the self rating badge and self text answers, followed by a new text question "Your response to {name}'s comments" (the `response*` field). Ratings stay editable after reveal; the initial value is preserved in `initialRatings`.
- If the self-assessment is not submitted yet: the panel reads "{name} hasn't submitted their self-assessment. You can submit now and add your response later." The response fields remain editable after submission without unlocking ratings (they are excluded from the 0.3 lock).
- Summary and meeting view show "Initial 2 → Final 3" next to any rating that changed after reveal. My Reviews shows the manager's response under each section once shared.

### 1.4 Goals and metrics card on the employee dashboard and in forms
- New `components/goals/goals-metrics-card.tsx` replacing `goals-panel.tsx`. Props: `employeeId`, `variant` (dashboard, form, compact), `canEdit`.
- Two columns. Goals: title, due date, status chip, "Personal" or "Role-set" badge (badge becomes meaningful in 3.2). Metrics: name, target and unit, latest result (populated in 3.1, "no result yet" until then).
- Placement: top of the employee dashboard above the performance summary; top of both forms, expanded; again inside the Looking ahead section.
- Empty state: "No goals or metrics yet. Your manager sets these." (after 1.5: "…or propose one").

### 1.5 Manager sets goals and metrics per team member; employees propose
- The card's `canEdit` mode adds inline "Add goal" and "Add metric" mini-forms (same fields as the profile page) so managers can add from the assess form and the meeting view, not only from the profile.
- `app/api/goals/route.ts` and `app/api/key-metrics/route.ts`: POST allowed only for the employee's manager or leadership (today any manager can add to anyone). GET for managers restricted to their reports (area leads per `permissions.ts`). PATCH/DELETE unchanged.
- Schema: `Goal` + `proposedById String?`; `GoalStatus` + `PROPOSED`. Employees may POST a goal for themselves; it is created as PROPOSED. Managers see "Proposed by {name}: Accept / Decline" on the card; Accept sets ACTIVE, Decline sets CANCELLED.

### 1.6 Goal status per cycle (G)
- Schema: new `GoalUpdate { id, goalId, cycleId, authorId, status (ON_TRACK, OFF_TRACK, DONE), note String?, createdAt }`, unique on (goalId, cycleId, authorId).
- Looking ahead section lists each active goal with a status pick and note; self and manager each record one. Manager marking DONE sets the goal to COMPLETED.
- Summary and meeting view show the goal with both updates side by side. `GET /api/goals` includes the current cycle's updates when `cycleId` is passed.

---

## Phase 2. Workflow

### 2.1 Share before the meeting; stages (I)
- Schema: rename `ManagerAssessment.resultsSentAt` to `sharedAt`; add `finalisedAt DateTime?`. `resultsSentAt` is kept as an alias in API responses for one release.
- `send-results` route becomes `POST /api/assessments/manager/share`. Requires the manager's assessment to be submitted. No longer requires the self-assessment to be submitted, but the confirm dialog warns when it is not. Dialog text: "This shares your ratings and comments with {name} ahead of your 1:1."
- `app/api/team/route.ts` returns a computed `stage`: not_started, in_progress, submitted, shared, meeting_done. Team page, dashboard roster, Assess Team page and the admin cycle table all display the stage badge from one `StageBadge` component and drop the "Results Sent" wording.
- The "only after the 1:1" warning is removed from both confirm dialogs.

### 2.2 Edit after submission with an audit log (A)
- Schema: new `AssessmentRevision { id, managerAssessmentId, changedById, changedAt, reason String?, before Json, after Json }`; `ManagerAssessment` + `editCount Int default 0`, `lastEditedAt DateTime?`.
- Server (`manager/route.ts` POST): the 0.3 lock is replaced by: allowed while the cycle is OPEN; if `sharedAt` is set a non-empty `reason` is required; the changed fields are diffed and one revision row is written in the same transaction; `editCount` and `lastEditedAt` updated. No revision when nothing changed.
- UI: a submitted form shows "Submitted 3 Sep · Edit" which unlocks the fields; on save after sharing a small modal asks for the reason. Summary and meeting view show "Edited 2 times · last 5 Sep by Jane" with an expandable list (field, before, after, reason) for the manager and leadership only. My Reviews shows an "Updated since shared" badge on the cycle (email arrives in 5.1).
- Self-assessment edits after submit: allowed while the cycle is open and until the manager has revealed that section (1.3); no revision log for self edits in this phase.

### 2.3 Meeting mode (H)
- `summary/[employeeId]/page.tsx` gains a "Meeting mode" toggle (`?mode=meeting`) for the manager. Layout in order:
  1. Header: name, period, stage, "Schedule 1:1" (button lands in 5.3).
  2. Goals and metrics card (compact) with results.
  3. Every section from `SECTIONS`, expanded, three columns: employee said, manager said, manager response. Initial → final rating shown where changed.
  4. Actions: prescribed actions from both boxes, then "Agreed actions": schema `AgreedAction { id, managerAssessmentId, text, done Boolean, goalId String?, createdAt }` with add, tick, remove, and "Make this a goal" (creates a Goal and links it).
  5. Meeting notes: autosave with a 1 second debounce via `PATCH /api/assessments/manager/meeting-notes` (notes only). Completion moves to `POST /api/assessments/manager/meeting-notes/complete`, which sets `oneOnOneCompletedAt`.
  6. "Mark 1:1 complete" button, with confirmation.
- Notes visibility (decision 3, recommended): the summary API returns `oneOnOneNotes` and agreed actions to the employee once `oneOnOneCompletedAt` is set. My Reviews shows a "From your 1:1" block.
- A print stylesheet hides navigation and buttons.

---

## Phase 3. Metric results and role-level templates

### 3.1 Record results against metrics; rating-versus-results check (C)
- Schema: new `KeyMetricResult { id, employeeId, cycleId, keyMetricId String?, metricTemplateId String?, actual String, achieved Boolean?, note String?, recordedById, createdAt, updatedAt }`, unique on (employeeId, cycleId, keyMetricId) and (employeeId, cycleId, metricTemplateId).
- Routes: `GET /api/key-metrics/results?employeeId&cycleId` (employee, their manager, leadership); `PUT` upserts one result. Either employee or manager may record; the card shows who recorded it and when.
- Both forms get a "Record results" step before section 1 (skippable when there are no metrics). The Performance rating step shows the metrics table inline: name, target, actual, hit or miss.
- Disconnect rule: performance rating of 2 or 3 while more metrics were missed than hit shows an amber note on the step: "This rating is above the metric results. Add evidence for the difference." The same note appears on the summary and meeting view. Analysis gains a "Rating vs results" card listing employees with a disconnect for the selected cycle (leadership; managers see their own reports).

### 3.2 Role-level metrics and goals set by the admin (new)
- Prerequisite: a managed role list. Schema: new `JobRole { id, name unique, isActive Boolean, createdAt }`; `User` + `jobRoleId String?`. Migration seeds one `JobRole` per distinct existing `jobTitle` and sets `jobRoleId`. `jobTitle` stays as the display string and is kept in sync from the role name.
- Admin users page and invite form: job title becomes a select of active roles, with "Manage roles" linking to the new page. CSV import matches the title column to a role by name and creates the role if missing.
- Schema: `MetricTemplate { id, jobRoleId, team String?, name, target, unit String?, notes String?, isActive, createdById, createdAt, updatedAt }`; `GoalTemplate { id, jobRoleId, team String?, title, description String?, dueOffsetDays Int?, isActive, createdById, createdAt, updatedAt }`; `Goal` + `templateId String?`.
- Resolution rules:
  - Metrics are virtual. `GET /api/key-metrics?employeeId` returns personal metrics plus every active template matching the employee's role (and team when the template sets one), each with `source: "personal" | "role"`. Results attach to the template id per employee per cycle (3.1). Managers cannot delete a role metric; they can add a note.
  - Goals are materialised. When a goal template is created or activated, one Goal (status ACTIVE, `templateId` set, due date = today + `dueOffsetDays`) is created for every matching active user who lacks one. When a user's role changes, the same runs for that user. Deactivating a template cancels its unmodified instances.
- New admin page `app/(app)/admin/roles/page.tsx`: roles list with employee counts; per role, metric templates and goal templates with add, edit, deactivate; a preview of who each template applies to. Admin dashboard card links to it.
- Badges: "Role-set" (purple) versus "Personal" (grey) on the card, both forms, summary, meeting view and the profile page.

### 3.3 Role-set items everywhere
- Covered by 1.4 and 3.2: the card, forms, summary and Analysis distinguish the two sources. Analysis "Rating vs results" counts role metrics too.

---

## Phase 4. Analysis and admin

### 4.1 Box percentages and talent tiers (J)
- `lib/nine-box.ts`: add `BOX1_TIERS` and `BOX2_TIERS` (Top, Medium, Low label sets; mapping to confirm) and a `getTier` helper.
- `calibration/page.tsx`: cell header becomes "Label · 4 (25%)" of the filtered set; a Names / Counts / Heatmap toggle (heatmap shades the cell by share); a tier bar under the grid with counts and percentages for the active grid; a Tier column with movement arrows in the month-over-month table.

### 4.2 Reports to on Analysis, per-manager rollup (K)
- Manager multi-select beside Titles and Teams (from `assessment.manager.name`, already in the payload). "Reports to" column in the movement table and on prescribed actions.
- New "By manager" card (leadership; a manager sees only their own row): headcount, submitted/total, average Talent Density and Cultural Momentum, % top tier, edits after share (`editCount > 0`), ratings adjusted after reveal (initial differs from final), rating-versus-results disconnects. `GET /api/assessments/manager` gains `includeDrafts=true` for leadership so completion can be computed.

### 4.3 User management filtering (L)
- `admin/users/page.tsx`: search box (name, email), selects for role, team, manager, status (active/inactive), sort by name, role or team, and "12 of 40 shown". Filters live in the URL query so they survive reloads. List becomes a table with a sticky header; inline edit controls unchanged.

### 4.4 Stage board with Assess actions (M)
- New `components/team/stage-board.tsx`: columns Not started, Self-review in, Manager review in, Submitted, Shared, Meeting done (from the 2.1 `stage`). Cards show name, title, self and manager chips, and buttons Assess, Share, Meeting depending on stage. No drag and drop.
- Manager dashboard: "List / Board" toggle above the roster. Admin cycle detail: read-only board of all assessments with links.

---

## Phase 5. Adoption

### 5.1 Due dates and event emails (N)
- Schema: `AssessmentCycle` + `selfDueAt`, `managerDueAt`, `meetingDueAt` (`DateTime?`). Admin create-cycle form gets three date inputs defaulting to the 7th, 14th and 21st of the cycle month.
- `lib/email.ts` gains templates on the existing Visory layout: cycle opened (all active users), self-assessment submitted (to the manager), review shared (to the employee, with link), meeting completed (to both), reminder, review updated after sharing.
- Schema: `NotificationLog { id, userId, type, refId, sentAt }`, unique on (userId, type, refId) so a retried request never double-sends.
- Sends are fire-and-forget after the response is written; a failed send is logged, never blocks the action.

### 5.2 Reminder cron (N)
- `vercel.json` with a cron calling `GET /api/cron/reminders` on Sunday and Monday at 8am Melbourne time (Vercel cron is UTC, so two entries adjusted at daylight saving changes, or one daily run at 8am that checks the weekday).
- Route checks `Authorization: Bearer $CRON_SECRET`. For every OPEN cycle: employees with no submitted self-assessment, managers with unsubmitted reviews, submitted-but-not-shared, shared-but-no-meeting. Sends one reminder per person per run (logged). After a due date plus three days the manager's manager is copied.

### 5.3 Calendar link (N)
- `lib/ics.ts` builds a VEVENT. Meeting mode gets "Schedule 1:1" that opens a Google Calendar template link (title, agenda, employee as guest) and a "Download .ics" fallback. The review-shared email includes the same link.

---

## Later

### 6.1 360 feedback (O)
- Schema `FeedbackRequest { id, employeeId, cycleId, requestedById, reviewerId String?, reviewerEmail String?, token unique, status, createdAt }`, `PeerFeedback { id, requestId, values ratings, strengths, growthAreas, submittedAt }`. Trigger from meeting mode or profile; tokenised email using the invite template; a public `/feedback/[token]` form; aggregated on the summary, anonymised below three responses.
