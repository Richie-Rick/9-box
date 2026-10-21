# Admin Guide — Running the Cycle

For whoever administers the Performance & Growth app: opening and closing cycles, managing users and job roles, reminders, and what the system does automatically.

## Opening a cycle

**Admin → Assessment Cycles → Create Cycle.**

1. Choose the quarter and year.
2. The three milestone dates prefill from the period: Ready to Meet on the 10th, Meeting Complete on the 20th, Results Sent on the 25th of the month after the quarter ends (Q2 lands a month later because of the financial-year close). Change any of them before creating; they must stay in order.
3. Click **Create Cycle**.

Creating a cycle:

- creates a self-assessment for every active user and a manager assessment for everyone who has a manager;
- emails every active user that the cycle is open, with the dates;
- puts the dates on everyone's dashboard timeline and the managers' boards, and uses them for reminders.

Only one cycle should normally be open at a time. Close the previous one first (toggle on its row) so reminders and the "current cycle" views don't split.

## Adjusting dates after opening

Expand a cycle's row. The three dates are editable at the top; **Save dates** applies them everywhere at once. Leaving a date blank restores the default.

## Watching progress

The expanded row shows counts (pending, in progress, ready to send, results sent) and a board of every person by status, with dots for self-assessment submitted, manager assessment submitted and review shared. Click a name to open their summary.

For the fuller picture use **Analysis → By manager**: reviews submitted against each manager's reports, averages, share in the top tier, edits after submission, ratings adjusted after reading the self-assessment, and rating-versus-results disconnects.

## Reminders

The app sends reminder emails on **Sunday and Monday mornings** while a cycle is open, one per person per kind per day:

- team members with no self-assessment submitted, against the Ready to Meet date;
- managers with reviews not submitted (Ready to Meet), reviews submitted but not shared and 1:1s not held (Meeting Complete), and results not sent (Results Sent).

Three days past a milestone, the manager's manager is copied in.

**Send reminders now** on the Assessment Cycles page sends the same set immediately, ignoring the weekday rule but not the once-a-day rule. Use it after opening a cycle late or before a deadline.

## Event emails

These go out automatically; nothing to configure:

| Event | Who is emailed |
|---|---|
| Cycle opened | Everyone active |
| Self-assessment submitted | The person's manager |
| Review shared | The team member, with a calendar link for the 1:1 |
| Review changed after sharing | The team member (at most once a day) |
| Meeting marked complete | Both the team member and the manager |

Each is sent once; a resend of the same action doesn't produce a second email.

## Closing a cycle

Toggle the cycle to **CLOSED** once results are sent for everyone (or the Results Sent date has passed). Closing stops reminders and new assessments from being started; existing assessments can still be edited by their owners, with every change logged. Reopen if needed. **Delete** removes the cycle and all its assessments and cannot be undone.

## Users

**Admin → User Management.**

- **Invite User** creates an invitation and emails a link to set a password. The person appears under *Pending invitations* until they register, then under *All users*. *Send Email* resends; *Copy Link* lets you send it yourself.
- **Bulk Import** takes a CSV or pasted spreadsheet rows (name, email, role, job title, team, manager email).
- **Copy Join Link** gives a self-registration link for people without an invitation.
- On each user row you can edit job title, team, start date, access role (Employee, Manager, Area Lead, Leadership, Admin), manager, active status, set a password, or delete.
- Search by name or email; filter by role, team, manager or status; sort. Filters are kept in the page address so a view can be shared.

**Job titles double as job roles.** Setting a job title links the person to that role (creating the role if new) and gives them any role-set goals and metrics. Pick an existing title from the suggestions where possible so people land in the same role rather than near-duplicates.

**Deactivating** a user keeps their history but removes them from cycles, boards and reminders. Deleting removes everything.

## Roles & Templates

**Admin → Roles & Templates.**

- Roles are created automatically from job titles; add one by hand if you're setting it up ahead of hiring.
- **Role-set metrics**: name, target, unit, notes, optionally only for one team. Saving creates a key metric for everyone active in the role; edits propagate; deactivating removes instances that never had a result (those with results stay as history).
- **Role-set goals**: title, description, optional "due in N days", optionally only for one team. Saving creates a goal for everyone in the role; deactivating cancels the active instances.
- New joiners, role changes and reactivations pick up the role's templates automatically.

People can't remove or retitle role-set items from their own pages; changes happen here.

## Access roles

| Role | Sees |
|---|---|
| **Employee** | Own dashboard, self-assessment, My Reviews, goals, tasks, resources |
| **Manager** | The above plus their direct reports: board, assessments, summaries, meetings, profiles, Analysis for their reports |
| **Area Lead** | As Manager, plus all managers' reports |
| **Leadership** | Everyone's assessments, summaries and Analysis; can correct any review (logged) |
| **Admin** | Everything, plus cycles, users, roles and resources |

## Resources

**Resources** holds guides like this one. Create or edit them with the built-in editor, choose which roles can see each one, and publish. Pasting from a formatted document keeps headings, lists and tables.

## Audit trail

Every edit to a submitted assessment, every unlock, share and send is recorded with who, when and what changed. Managers and leadership see it at the bottom of the summary page; team members see the history of their own self-assessment on My Reviews.
