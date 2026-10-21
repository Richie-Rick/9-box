-- Seed the Resources library with the cycle guides (docs/resources/*.md
-- rendered to HTML). Idempotent: a slug that already exists is left alone, so
-- edits made in the app are never overwritten. Attributed to the earliest
-- admin account; skipped entirely if there is no admin yet.
--
-- Production's schema drifted from the migrations (see 0016/0017): the
-- database was first created with `prisma db push`, so tables and columns
-- added by later migrations can be missing. Resources were never used in
-- production, so recreate whatever of migrations 0006 and 0008 is absent
-- before seeding. All of this is idempotent and touches no existing data.

CREATE TABLE IF NOT EXISTS "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "allowedRoles" "Role"[] DEFAULT ARRAY['EMPLOYEE', 'MANAGER', 'AREA_LEAD', 'LEADERSHIP', 'ADMIN']::"Role"[];
CREATE UNIQUE INDEX IF NOT EXISTS "Resource_slug_key" ON "Resource"("slug");
CREATE INDEX IF NOT EXISTS "Resource_slug_idx" ON "Resource"("slug");
CREATE INDEX IF NOT EXISTS "Resource_published_idx" ON "Resource"("published");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Resource_createdById_fkey') THEN
    ALTER TABLE "Resource" ADD CONSTRAINT "Resource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Resource" ("id", "title", "slug", "content", "published", "sortOrder", "allowedRoles", "createdById", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, $res$Performance & Growth Cycle — Process Overview$res$, 'process-overview', $res$<p>The most valuable part of this isn&#39;t the ratings. It&#39;s the gap between how you see yourself and how your manager sees you, and the conversation that gap opens up. Everything in the process is built to make that conversation honest, prepared and useful.</p>
<h2>The principles</h2>
<p><strong>Transparency.</strong> Every rating is shared, with the rationale behind it. Your manager shares their review with you <em>before</em> your 1:1 so you walk in having read it. Nothing is hidden and nothing is sprung on you in the room.</p>
<p><strong>Growth orientation.</strong> This exists to develop you, not just evaluate you. Every cycle ends with agreed actions, and each 9-box placement comes with a prescribed action your manager commits to.</p>
<p><strong>Consistency.</strong> One quarterly cadence and one rating model across every team. The same five sections, the same three-point scales, the same milestones.</p>
<p><strong>Accountability.</strong> Both of you own it. You complete a self-assessment; your manager completes theirs <em>without</em> seeing yours; then they read yours and respond to it in writing.</p>
<p><strong>Grounded in evidence.</strong> Goals and key metrics are reviewed and results recorded before anyone rates anything, so the conversation starts from what actually happened, not from how the quarter felt.</p>
<p><strong>Simplicity.</strong> Three-point scales across the board. Clear and decisive; no hiding in the middle.</p>
<h2>The quarterly rhythm</h2>
<p>Cycles run quarterly (Q1 January–March, Q2 April–June, Q3 July–September, Q4 October–December). The review happens in the month after the quarter closes. Each cycle has three milestone dates, set by the admin when the cycle is opened and shown on your dashboard:</p>
<table>
<thead>
<tr>
<th>Milestone</th>
<th>What it means</th>
<th>Typical date</th>
</tr>
</thead>
<tbody><tr>
<td><strong>Ready to Meet</strong></td>
<td>Your self-assessment and your manager&#39;s assessment are both submitted</td>
<td>10th of the month after the quarter</td>
</tr>
<tr>
<td><strong>Meeting Complete</strong></td>
<td>Your 1:1 has been held and marked complete</td>
<td>20th</td>
</tr>
<tr>
<td><strong>Results Sent</strong></td>
<td>Results are sent and the cycle is closed for you</td>
<td>25th</td>
</tr>
</tbody></table>
<p>Q2 ends on the financial-year close, so its review lands a month later than the others. Dates can differ cycle to cycle; the ones that apply are always on the dashboard timeline.</p>
<p>Who completes a cycle: anyone who worked six weeks or more of the quarter. People who started later set up their goals and metrics and join the next cycle.</p>
<h2>The five sections</h2>
<p>Both the self-assessment and the manager assessment are built from the same five sections. Where you answer a question about yourself, your manager answers its mirror about you. The two are compared side by side afterwards.</p>
<table>
<thead>
<tr>
<th>Section</th>
<th>You rate / describe</th>
<th>Your manager rates / describes</th>
</tr>
</thead>
<tbody><tr>
<td><strong>Performance</strong></td>
<td>Your performance (1–3), the evidence, key achievements, blockers, what you learned</td>
<td>Your performance (1–3), the evidence, achievements they observed, blockers they&#39;ll help remove</td>
</tr>
<tr>
<td><strong>Growth Readiness</strong></td>
<td>How ready you are to take on more (1–3), where you want to grow</td>
<td>How ready you are to take on more (1–3), the evidence</td>
</tr>
<tr>
<td><strong>Values Alignment</strong></td>
<td>Each of the four values (1–3), examples</td>
<td>Each of the four values (1–3), examples</td>
</tr>
<tr>
<td><strong>Engagement</strong></td>
<td>How engaged you feel (1–3), what&#39;s driving it, the support you need</td>
<td>How engaged you appear (1–3), what they observe, the support they&#39;ll commit to</td>
</tr>
<tr>
<td><strong>Looking Ahead</strong></td>
<td>Your goals for next quarter (tracked goals, not free text)</td>
<td>Priorities and notes for your next quarter</td>
</tr>
</tbody></table>
<p>Your manager also writes a <strong>response</strong> to your comments in each of the first four sections, after reading them.</p>
<h2>The rating scales</h2>
<p><strong>Performance</strong> measures delivery against your role requirements, grounded in your key metrics and goals.</p>
<ul>
<li><strong>3 — Exceeding:</strong> Frequently surpassing what the role requires. Takes initiative, delivers above the bar, measurably lifts outcomes.</li>
<li><strong>2 — Meeting:</strong> Reliably delivering on all core role requirements. Consistent, on time, meets the expected standard.</li>
<li><strong>1 — Below:</strong> Consistently missing key metrics or role requirements. Quality, timeliness or reliability issues are evident and recurring.</li>
</ul>
<p><strong>Growth Readiness</strong> measures how ready you are to expand beyond your current role.</p>
<ul>
<li><strong>3 — Ready Now:</strong> Ready for scope expansion or the next role within 3–6 months.</li>
<li><strong>2 — Building:</strong> On track for scope expansion or the next role in 6–12 months.</li>
<li><strong>1 — Developing:</strong> Not yet ready for scope expansion. Focused on mastering the current role.</li>
</ul>
<p><strong>Values Alignment</strong> is rated per value (Customer First, Step Into the Arena, Flock to Problems, Give Energy); the overall score is the rounded average of the four.</p>
<ul>
<li><strong>3 — Exceeding:</strong> A role model. Actively reinforces the value in others.</li>
<li><strong>2 — Meeting:</strong> Consistently demonstrates the value day to day. Reliable and visible.</li>
<li><strong>1 — Below:</strong> Rarely demonstrates it without prompting. Inconsistent or absent.</li>
</ul>
<p><strong>Engagement</strong> measures energy, effort and connection to the team.</p>
<ul>
<li><strong>3 — Exceeding:</strong> Deeply invested. Proactively contributes ideas, supports teammates, takes on challenges.</li>
<li><strong>2 — Meeting:</strong> Present and participative. Completes work with a reasonable attitude. Contributes when asked.</li>
<li><strong>1 — Below:</strong> Withdrawn, minimal discretionary effort, low energy. Limited voluntary contribution.</li>
</ul>
<h2>The two 9-box placements</h2>
<p>Your manager&#39;s four ratings place you on two grids. Each placement has a name and a prescribed action your manager commits to.</p>
<p><strong>Talent Density: Performance × Growth Readiness.</strong> The capability lens: are you delivering, and how ready are you for more?</p>
<table>
<thead>
<tr>
<th></th>
<th>Perf Below (1)</th>
<th>Perf Meeting (2)</th>
<th>Perf Exceeding (3)</th>
</tr>
</thead>
<tbody><tr>
<td><strong>Ready Now (3)</strong></td>
<td>Remove the Blockers</td>
<td>Stretch &amp; Develop</td>
<td>Ready to Promote</td>
</tr>
<tr>
<td><strong>Building (2)</strong></td>
<td>Build the Foundations</td>
<td>Keep Growing</td>
<td>Expand the Role</td>
</tr>
<tr>
<td><strong>Developing (1)</strong></td>
<td>Intervene Now</td>
<td>Maintain &amp; Recognise</td>
<td>Deepen the Expertise</td>
</tr>
</tbody></table>
<p><strong>Cultural Momentum: Values Alignment × Engagement.</strong> The cultural and motivational lens: are you showing up the right way, and do you want to be here?</p>
<table>
<thead>
<tr>
<th></th>
<th>Values Below (1)</th>
<th>Values Meeting (2)</th>
<th>Values Exceeding (3)</th>
</tr>
</thead>
<tbody><tr>
<td><strong>Engaged Exceeding (3)</strong></td>
<td>Redirect the Energy</td>
<td>Reinforce the Behaviours</td>
<td>Protect &amp; Amplify</td>
</tr>
<tr>
<td><strong>Engaged Meeting (2)</strong></td>
<td>Have the Conversation</td>
<td>Stay the Course</td>
<td>Invest Deeper</td>
</tr>
<tr>
<td><strong>Engaged Below (1)</strong></td>
<td>Assess the Fit</td>
<td>Find What&#39;s Draining</td>
<td>Re-energise Now</td>
</tr>
</tbody></table>
<p>For Analysis, the nine boxes roll up into three tiers: <strong>Top</strong> (Ready to Promote, Stretch &amp; Develop, Expand the Role), <strong>Medium</strong> (Keep Growing, Deepen the Expertise, Remove the Blockers) and <strong>Low</strong> (Intervene Now, Build the Foundations, Maintain &amp; Recognise), with the equivalent mapping for Cultural Momentum.</p>
<h2>How a cycle runs, step by step</h2>
<ol>
<li><strong>Cycle opens.</strong> Everyone gets an email. Your dashboard shows the cycle, its three dates and a <em>Start Self-Assessment</em> button.</li>
<li><strong>Record results.</strong> On the first page of your self-assessment you record the actual result against each key metric for the quarter and mark it hit or missed. Your manager sees the same numbers.</li>
<li><strong>Self-assessment.</strong> You complete the five sections and submit. Your manager is emailed.</li>
<li><strong>Manager assessment, blind.</strong> Your manager rates each section <em>before</em> the app lets them see what you wrote for it. Then they reveal your answers and write a response. They submit.</li>
<li><strong>Ready to Meet.</strong> Once both are in, you move to Ready to Meet on your manager&#39;s board.</li>
<li><strong>Share.</strong> Your manager shares their review. You get an email; your ratings, their comments and responses appear on your dashboard and under My Reviews. Read it before the 1:1. If your manager changes anything after sharing they must give a reason, and you&#39;ll see &quot;Updated since shared&quot;.</li>
<li><strong>The 1:1.</strong> Run from the meeting page, which shows your placements, what you both said side by side, your goals and results, and the notes and agreed actions. Your manager marks the meeting complete; the notes appear on your My Reviews and agreed actions land on your Tasks page.</li>
<li><strong>Results sent.</strong> Your manager sends results to close out. The assessment is locked (your manager can still add to their responses).</li>
<li><strong>Act.</strong> You and your manager work the agreed actions and goals through the quarter. Goal progress can be updated by either of you at any time; each of you keeps your own update.</li>
</ol>
<h2>What you&#39;ll see in My Reviews</h2>
<ul>
<li>A performance summary: your latest ratings and your average across cycles.</li>
<li>For each cycle: your Talent Density and Cultural Momentum placements with the prescribed actions; the full comparison of your answers and your manager&#39;s, section by section, including their responses; a note if the review was updated after it was shared; the notes from your 1:1 once it&#39;s complete; and a history of any edits to your own self-assessment.</li>
<li>The manager&#39;s side only appears once they&#39;ve shared or sent results. Until then you see your own answers and the status of theirs.</li>
</ul>
<h2>Where things live in the app</h2>
<table>
<thead>
<tr>
<th>What</th>
<th>Where</th>
</tr>
</thead>
<tbody><tr>
<td>Current cycle status, start or continue your self-assessment</td>
<td><strong>Dashboard</strong></td>
</tr>
<tr>
<td>Your goals and key metrics, set your own</td>
<td><strong>Goals &amp; Metrics</strong></td>
</tr>
<tr>
<td>Everything your manager shared, your placements, 1:1 notes</td>
<td><strong>My Reviews</strong></td>
</tr>
<tr>
<td>Actions agreed in your 1:1</td>
<td><strong>Tasks</strong></td>
</tr>
<tr>
<td>Guides like this one</td>
<td><strong>Resources</strong></td>
</tr>
<tr>
<td>Managers: your team&#39;s progress board and your own cycle</td>
<td><strong>Dashboard</strong></td>
</tr>
<tr>
<td>Managers: each report&#39;s profile, history, goals and metrics</td>
<td><strong>My Team</strong></td>
</tr>
<tr>
<td>Managers and leadership: the 9-box grid, tiers, trends and per-manager rollup</td>
<td><strong>Analysis</strong></td>
</tr>
</tbody></table>$res$, true, 10, ARRAY['EMPLOYEE','MANAGER','AREA_LEAD','LEADERSHIP','ADMIN']::"Role"[],
       (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1), now(), now()
WHERE EXISTS (SELECT 1 FROM "User" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "Resource" WHERE "slug" = 'process-overview');

INSERT INTO "Resource" ("id", "title", "slug", "content", "published", "sortOrder", "allowedRoles", "createdById", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, $res$Team Member Guide$res$, 'team-member-guide', $res$<p>Your walkthrough for the quarterly cycle: what to do, when, and what to expect, screen by screen.</p>
<h2>Before the cycle: your goals and key metrics</h2>
<p>Open <strong>Goals &amp; Metrics</strong> in the sidebar. You&#39;ll see two lists.</p>
<p><strong>Key metrics</strong> are the recurring measures for your role, the numbers that describe what good looks like in your seat. Some are set by your manager, some you set yourself, and some are <strong>Role-set</strong>: attached to your job title by an admin and shared by everyone in that role. Role-set metrics can&#39;t be removed from your page; if one doesn&#39;t fit, raise it with your manager.</p>
<p><strong>Goals</strong> are time-bound commitments agreed with your manager. A goal may span one quarter or several. You can add your own at any time (title, description, due date); your manager can add goals for you too. Each goal is labelled with who set it.</p>
<p>Before each cycle, check both lists are current. Aim for three to five key metrics and two to four active goals. If your page is empty, talk to your manager; agreeing them together is a useful conversation in itself.</p>
<h2>When the cycle opens</h2>
<p>You&#39;ll get an email, and your <strong>Dashboard</strong> shows a banner for the open cycle with the three milestone dates and a <strong>Start Self-Assessment</strong> button. The dates matter:</p>
<ul>
<li><strong>Ready to Meet</strong> is when your self-assessment needs to be submitted (your manager&#39;s assessment is due the same day).</li>
<li><strong>Meeting Complete</strong> is when your 1:1 should have happened.</li>
<li><strong>Results Sent</strong> is when the cycle closes.</li>
</ul>
<p>The app emails a reminder on Sunday or Monday mornings for anything outstanding. If you&#39;re up to date you won&#39;t hear from it.</p>
<h2>Your self-assessment</h2>
<p>Allow 30–45 minutes. You can save a draft at any point and come back; your manager sees nothing until you submit.</p>
<p><strong>Layout.</strong> At the top right of the form is a toggle: <strong>One at a time</strong> shows a section per step with chips to jump between them; <strong>All on one page</strong> stacks every section with a menu down the side and a save bar at the bottom. Use whichever you prefer; the app remembers.</p>
<p><strong>1. Performance.</strong> Rate your performance this quarter (1–3) and give the evidence. Below the questions is the <strong>Goals &amp; Key Metrics</strong> panel. Do this part first:</p>
<ul>
<li>For each key metric, enter the <strong>actual result</strong> for the quarter, mark it <strong>Hit</strong>, <strong>Missed</strong> or <strong>Unsure</strong> against the target, add a comment if useful, and save. Your manager sees the same numbers.</li>
<li>For each goal, record your progress: <strong>On track</strong>, <strong>Off track</strong> or <strong>Complete</strong>, with a note. This is <em>your</em> update; your manager records theirs separately and both show side by side.</li>
</ul>
<p>Then describe your key achievements, the blockers or challenges you faced, and what you learned.</p>
<p><strong>2. Growth Readiness.</strong> Rate how ready you are to take on more scope or a bigger role (Developing / Building / Ready Now), and say where you want to grow next and what shows you&#39;re ready. This is new for the self-assessment: your manager rates it too and you&#39;ll see both views afterwards.</p>
<p><strong>3. Values Alignment.</strong> Rate yourself on each of the four values, Customer First, Step Into the Arena, Flock to Problems and Give Energy (1–3 each), then give specific examples. Each rating has a few prompts to consider.</p>
<p><strong>4. Engagement.</strong> Rate how engaged you feel (1–3), what&#39;s driving that, and what support you need from your manager.</p>
<p><strong>5. Looking Ahead.</strong> Add your goals for next quarter as tracked goals (title, description, due date). They&#39;re saved to your profile straight away. If you set goals last quarter in the old free-text box, they&#39;re shown here for reference.</p>
<p><strong>Submit.</strong> The Submit button stays disabled until every rating is set; the form lists what&#39;s still needed and jumps you to it. Once submitted you return to the dashboard and your manager is emailed.</p>
<p><strong>Changing it afterwards.</strong> You can re-open a submitted self-assessment from the dashboard (<strong>Edit Self-Assessment</strong>). Edits are recorded in a history you can see on My Reviews.</p>
<h2>Tips for a good self-assessment</h2>
<p><strong>Be honest, not performative.</strong> The value is in genuine reflection. If you had a rough quarter, say so; your manager will respect the self-awareness more than a polished version of events.</p>
<p><strong>Use specifics.</strong> A deliverable, a client, a metric, a moment. &quot;I did well&quot; tells your manager nothing. &quot;I turned around the BAS lodgements for 12 clients two days ahead of deadline&quot; tells them everything.</p>
<p><strong>Let the metrics do some of the talking.</strong> You&#39;ve just recorded hit or missed against each one. Your performance rating should sit comfortably alongside that record.</p>
<p><strong>It&#39;s fine to rate yourself lower than your manager does.</strong> Self-awareness is a strength.</p>
<p><strong>Submit before the Ready to Meet date.</strong> Your manager can&#39;t share or meet until both assessments are in.</p>
<h2>Before your 1:1: read your review</h2>
<p>Your manager rates you <em>without</em> seeing your self-assessment, then reads your answers section by section and writes a response to each. Once they&#39;ve submitted, they <strong>share</strong> the review with you ahead of the 1:1. You&#39;ll get an email, your dashboard card shows <strong>Shared</strong>, and <strong>My Reviews</strong> shows:</p>
<ul>
<li>your placements on the two 9-box grids with the prescribed actions</li>
<li>every section side by side: your rating and theirs, your comments and theirs, and their written response to what you said</li>
<li>any goals and key-metric results for the quarter</li>
</ul>
<p>Read it before you meet. The aim is a conversation about the gaps, not a reveal in the room.</p>
<p>If your manager changes a rating or comment after sharing, they have to give a reason, and you&#39;ll see an <strong>Updated since shared</strong> badge (and get an email) so you know to re-read.</p>
<h2>Your 1:1</h2>
<p>This is a 45-minute structured conversation, the most important meeting of the quarter. Your manager runs it from the meeting page, which shows the same comparison you&#39;ve already read, your goals and results, and a space for notes and actions.</p>
<p><strong>How it runs.</strong> A human check-in first. Then you walk through your self-assessment; your manager listens and asks questions. Then they take you through their ratings and responses, leading with the rating before explaining it. Then the gap: where your views differ and why. You close by confirming the prescribed actions, any goal changes, and who&#39;s doing what.</p>
<p><strong>What to expect.</strong> Leading with the rating can feel confronting the first time; that&#39;s normal, and it&#39;s about your output and behaviours, not your character. You&#39;re encouraged to disagree. If a rating doesn&#39;t feel right, say so and bring your evidence. Your manager will ask &quot;does this feel fair?&quot; and genuinely wants the answer.</p>
<p><strong>Actions.</strong> Every agreed action is written into the meeting with an owner and a due date. They become tasks on your <strong>Tasks</strong> page, where you and your manager can both see and update them.</p>
<h2>After the 1:1</h2>
<p>When your manager marks the meeting complete, their notes appear under <strong>From your 1:1</strong> on My Reviews and you&#39;ll get an email. They then <strong>send results</strong> to close the cycle out; your dashboard card shows <strong>Review Complete</strong>.</p>
<p>If anything on My Reviews doesn&#39;t match what was discussed, raise it with your manager. They can still add to their written responses after results are sent.</p>
<h2>Through the quarter</h2>
<p>Keep your goals current from <strong>Goals &amp; Metrics</strong>: update progress, add new ones, and record results when you have them rather than at the end of the quarter. Work your tasks from the <strong>Tasks</strong> page. Over time My Reviews builds into a history of your ratings, your manager&#39;s, and the gap between them. That history is yours; use it to own your development, not just to respond to feedback once a quarter.</p>$res$, true, 20, ARRAY['EMPLOYEE','MANAGER','AREA_LEAD','LEADERSHIP','ADMIN']::"Role"[],
       (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1), now(), now()
WHERE EXISTS (SELECT 1 FROM "User" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "Resource" WHERE "slug" = 'team-member-guide');

INSERT INTO "Resource" ("id", "title", "slug", "content", "published", "sortOrder", "allowedRoles", "createdById", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, $res$Manager Guide$res$, 'manager-guide', $res$<p>Your end-to-end guide to the quarterly cycle: how to assess each direct report, how to share and run the 1:1, how to close out, and how the Review and Planning rhythm with People supports you.</p>
<h2>Your dashboard</h2>
<p>The manager dashboard shows:</p>
<ul>
<li><strong>Your own cycle</strong> at the top: you complete a self-assessment and get reviewed like everyone else.</li>
<li><strong>Self-assessments done / manager assessments done</strong> counts for your team.</li>
<li>The <strong>meeting pipeline</strong>: a board with one card per direct report, moving through <strong>In Assessment → Ready to Meet → Meeting Scheduled → Meeting Complete → Review Complete</strong>. Each column shows its due date; the timeline above shows the three milestones for the cycle. Cards show a tracking dot (on track, due soon, overdue) and the actions available at that stage.</li>
<li><strong>Team tasks</strong>: open actions across your reports.</li>
</ul>
<p>A card moves from In Assessment to Ready to Meet automatically once both assessments are submitted. You drag it to Meeting Scheduled when the 1:1 is booked; completing the meeting moves it to Meeting Complete; sending results moves it to Review Complete. You can also filter the board by job title and tenure.</p>
<h2>Before the cycle: goals and key metrics</h2>
<p>Every report needs current <strong>key metrics</strong> (recurring measures for the role) and <strong>goals</strong> (time-bound commitments) before the cycle opens. Open <strong>My Team → View Profile</strong> to add or edit them, or ask the person to set their own from Goals &amp; Metrics. Items attached to a job title by an admin appear automatically as <strong>Role-set</strong> and apply to everyone in that role. See <em>Setting up Goals and Key Metrics</em> for detail and examples.</p>
<p>If a profile is empty when the cycle opens, the assessment will feel ungrounded and you&#39;ll lose the value of the framework for that quarter.</p>
<h2>Completing the assessment</h2>
<p>Click <strong>Assess</strong> on a report&#39;s card (or <strong>Assess</strong> / <strong>Edit Review</strong> on My Team). The form has the same five sections as the self-assessment, and the same <strong>One at a time / All on one page</strong> toggle.</p>
<p><strong>Rate first, then read.</strong> You rate each section without seeing what the person wrote. The app enforces this: each section has a <em>&quot;Show what {name} said&quot;</em> panel that only unlocks once your ratings for that section are saved. That&#39;s deliberate. The gap between your view and theirs is the point of the conversation, so don&#39;t pre-adjust to avoid a hard one.</p>
<p><strong>1. Performance.</strong> Below the rating is the <strong>Goals &amp; Key Metrics</strong> panel. Record or confirm the actual result against each key metric, mark it <strong>Hit / Missed / Unsure</strong>, and record your own progress update on each goal (the person&#39;s update shows alongside yours). You can&#39;t move past this section until every key metric has a result.</p>
<p>Then rate performance (1–3) with evidence, describe the achievements you observed, and the blockers you&#39;ll help remove.</p>
<p><strong>Rating versus results.</strong> If you rate performance as Meeting or above while more metrics were missed than hit, a warning appears on the section and on the summary. Either your evidence carries the rating, or the targets need a conversation. Leadership can see these disconnects on Analysis.</p>
<p><strong>2. Growth Readiness.</strong> How ready are they to take on more? Developing (building the basics), Building (growing into more), Ready Now (could step up today). Give the evidence: stretch work, learning agility, feedback sought and applied.</p>
<p><strong>3. Values Alignment.</strong> Rate each of the four values separately, with prompts to consider, and give examples of values-aligned behaviour. The overall values score is the rounded average.</p>
<p><strong>4. Engagement.</strong> Rate how engaged they appear, what you observe driving it, and the support you&#39;ll commit to next quarter.</p>
<p><strong>5. Looking Ahead.</strong> Priorities and notes for their next quarter.</p>
<p><strong>Reveal and respond.</strong> Once a section&#39;s ratings are saved, click <em>Show what {name} said</em>. Their rating and comments for that section appear; write your response beneath. Respond to what they actually wrote: acknowledge it, add context, or say where you see it differently. If they haven&#39;t submitted yet, you can submit now and come back to respond later; responses stay editable right through, including after results are sent.</p>
<p><strong>Submit.</strong> Submit needs every rating set. After submitting you can still <strong>Edit assessment</strong> until results are sent; every change is logged in the audit trail on the summary page.</p>
<h2>Feedback principles</h2>
<p><strong>Be specific.</strong> Every rating needs at least one concrete example you&#39;re prepared to share. &quot;They&#39;re doing fine&quot; is not evidence.</p>
<p><strong>Rate the work, not the person.</strong> You&#39;re assessing output and behaviours, not character.</p>
<p><strong>Don&#39;t anchor to the self-assessment.</strong> The app won&#39;t let you see it before you rate. Keep that spirit when you edit afterwards: adjust for new evidence, not to soften the conversation.</p>
<p><strong>Let the metrics anchor performance.</strong> You&#39;ve just marked each one hit or missed. If the rating and the record disagree, say why in the evidence.</p>
<h2>Share the review before the 1:1</h2>
<p>Once you&#39;ve submitted, <strong>share</strong> the review: <em>Share review</em> on the Kanban card, on the summary page, or on the meeting page. Sharing makes your ratings, comments and responses visible to the person on their dashboard and My Reviews, and emails them with a calendar link for the 1:1. The aim is that they walk into the meeting having read it, so the time goes on the conversation rather than the reveal.</p>
<p>You can share before their self-assessment is in (the app warns you); you&#39;ll just have no comments to respond to yet.</p>
<p><strong>Editing after sharing.</strong> You can still change ratings and comments, but the form asks for a one-line reason. The reason is recorded in the audit trail, and the person sees an <em>Updated since shared</em> badge and gets an email. Responses don&#39;t need a reason.</p>
<h2>Running the 1:1</h2>
<p>Book it with <em>Add to Google Calendar</em> or the <em>.ics</em> link on the meeting page, drag the card to <strong>Meeting Scheduled</strong>, then open the meeting from the card (<strong>Start Meeting</strong>) or from the summary.</p>
<p>The meeting page gives you everything in one place: the two 9-box placements with prescribed actions, what you both said section by section (already expanded, including your responses), goals and key-metric results, then notes and actions. It prints cleanly if you want it on paper.</p>
<p>The 1:1 is 45 minutes, structured, everything in the open.</p>
<ul>
<li><strong>0–5 min: check-in.</strong> How are they going? Anything outside work affecting them? Start human.</li>
<li><strong>5–15 min: their self-assessment.</strong> They walk through it. You listen and ask clarifying questions. Don&#39;t correct or react yet.</li>
<li><strong>15–25 min: your feedback on Performance and Growth Readiness.</strong> Lead with the rating, then the rationale. They&#39;ve read it; go straight to where you differ and why.</li>
<li><strong>25–30 min: Values and Engagement.</strong> The per-value breakdown and the engagement rating, with rationale.</li>
<li><strong>30–40 min: the gap.</strong> The most important part. Where do your views diverge? What are they not seeing? What are you not seeing? Stay curious.</li>
<li><strong>40–45 min: actions and forward look.</strong> Confirm the prescribed actions, agree priorities and goal changes. Write them into the meeting as actions.</li>
</ul>
<p><strong>Notes and actions.</strong> Type notes as you go and <strong>Save notes</strong>. Add each agreed action with an owner and due date; each becomes a task visible to both of you on the Tasks page. Nothing agreed verbally and forgotten.</p>
<p><strong>Complete the meeting.</strong> Click <strong>Complete Meeting</strong>. The card moves to Meeting Complete, the person is emailed, and your notes appear on their My Reviews.</p>
<h3>In the room</h3>
<p><strong>Lead with the rating before you explain it.</strong> Don&#39;t build up to the number.</p>
<p><strong>Separate performance from person.</strong> &quot;Your output on the BAS lodgements was below what we need&quot; is feedback. &quot;You&#39;re not good enough&quot; is not.</p>
<p><strong>Invite disagreement.</strong> Ask &quot;does this feel fair?&quot; and listen. If they push back with evidence, be willing to adjust, with a reason, after the meeting.</p>
<p><strong>Close the loop.</strong> Every 1:1 ends with written actions both of you can see.</p>
<h2>Close out: send results</h2>
<p>From the Meeting Complete column (or the summary page) click <strong>Send Results</strong>. This closes the cycle for that person: the card moves to Review Complete, their dashboard shows <em>Review Complete</em>, and the assessment is locked. If you need to change a rating afterwards, <strong>Unlock &amp; edit</strong> on the assess page re-opens it (logged) and you can re-send.</p>
<p>The summary page asks you to confirm you&#39;ve held the 1:1 if the meeting isn&#39;t marked complete yet.</p>
<h2>How the ratings work together</h2>
<p>Your four ratings produce two placements, each with a prescribed action you commit to.</p>
<p><strong>Talent Density: Performance × Growth Readiness.</strong> Capability and development.</p>
<table>
<thead>
<tr>
<th></th>
<th>Perf Below (1)</th>
<th>Perf Meeting (2)</th>
<th>Perf Exceeding (3)</th>
</tr>
</thead>
<tbody><tr>
<td><strong>Ready Now (3)</strong></td>
<td><strong>Remove the Blockers.</strong> Diagnose the blocker. 30-day action plan. Review fortnightly.</td>
<td><strong>Stretch &amp; Develop.</strong> Assign a stretch goal or project. Set a 90-day development goal.</td>
<td><strong>Ready to Promote.</strong> Career conversation. Discuss promotion or expanded scope this quarter.</td>
</tr>
<tr>
<td><strong>Building (2)</strong></td>
<td><strong>Build the Foundations.</strong> 30-day improvement plan with measurable outcomes.</td>
<td><strong>Keep Growing.</strong> Acknowledge reliability. Set one small growth goal.</td>
<td><strong>Expand the Role.</strong> Assign stretch goals if aligned to their ambitions.</td>
</tr>
<tr>
<td><strong>Developing (1)</strong></td>
<td><strong>Intervene Now.</strong> Direct conversation this week. Move to PIP.</td>
<td><strong>Maintain &amp; Recognise.</strong> Clarify expectations. Ask if they want more or are content.</td>
<td><strong>Deepen the Expertise.</strong> Recognise expertise. Protect from burnout.</td>
</tr>
</tbody></table>
<p><strong>Cultural Momentum: Values Alignment × Engagement.</strong> Culture and motivation.</p>
<table>
<thead>
<tr>
<th></th>
<th>Values Below (1)</th>
<th>Values Meeting (2)</th>
<th>Values Exceeding (3)</th>
</tr>
</thead>
<tbody><tr>
<td><strong>Engaged Exceeding (3)</strong></td>
<td><strong>Redirect the Energy.</strong> 30-day focus on 1–2 specific values with examples.</td>
<td><strong>Reinforce the Behaviours.</strong> Call out the values behaviours you want more of.</td>
<td><strong>Protect &amp; Amplify.</strong> Look for further cultural impact opportunities.</td>
</tr>
<tr>
<td><strong>Engaged Meeting (2)</strong></td>
<td><strong>Have the Conversation.</strong> Direct conversation on alignment. No shift in two months → escalate.</td>
<td><strong>Stay the Course.</strong> One intentional check-in question per 1:1.</td>
<td><strong>Invest Deeper.</strong> Ask what would deepen their engagement.</td>
</tr>
<tr>
<td><strong>Engaged Below (1)</strong></td>
<td><strong>Assess the Fit.</strong> Honest assessment on fit.</td>
<td><strong>Find What&#39;s Draining.</strong> Intervene now. Offer tangible relief ASAP.</td>
<td><strong>Re-energise Now.</strong> Identify what&#39;s draining them. Create actions.</td>
</tr>
</tbody></table>
<p>Both placements and their actions are on the summary page, the meeting page, and the person&#39;s My Reviews.</p>
<h2>Analysis</h2>
<p><strong>Analysis</strong> in the sidebar shows your team on both grids for any cycle (or averaged across a range of quarters). Use it when preparing conversations and before your Review and Planning meeting.</p>
<ul>
<li>Switch between <strong>Talent Density</strong> and <strong>Cultural Momentum</strong>; view <strong>Names</strong>, <strong>Counts</strong> or a <strong>Heatmap</strong>; every cell shows its count and share.</li>
<li>The <strong>tier bar</strong> rolls the nine boxes into Top, Medium and Low talent.</li>
<li>Filter by title, team, manager and tenure.</li>
<li><strong>Key insights</strong> show averages with the trend against last quarter.</li>
<li><strong>Quarter-over-quarter movement</strong> lists each person&#39;s ratings, tier and who they report to, with arrows for change.</li>
<li><strong>Rating vs results</strong> lists anyone rated Meeting or above whose metrics were mostly missed.</li>
<li><strong>By manager</strong> shows, for each manager, reviews submitted against reports, average scores, share in the top tier, reviews edited after submission, ratings adjusted after reading the self-assessment, and disconnects. Leadership uses this table; it&#39;s the accountability view.</li>
<li><strong>Prescribed actions</strong> lists the action for every person on the selected grid.</li>
</ul>
<h2>Your Review and Planning rhythm with People</h2>
<p>Alongside the quarterly cycle, you have a regular <strong>Review and Planning</strong> meeting with the People Lead. This is where organisation-level consistency lives, and where you get real-time support.</p>
<p><strong>Purpose.</strong> How your team is tracking, the ratings you&#39;ve given, development actions, performance and resourcing, early risks, consistency across managers, and patterns you want help thinking through.</p>
<p><strong>What to bring.</strong> Anyone you&#39;ve rated high-concern or high-potential, recent 1:1 actions, themes across the team, and the Analysis views for your team. Between meetings, the door is open: if something material comes up, reach out rather than wait.</p>
<h2>Manager quick reference</h2>
<p>After each cycle, answer five questions for every direct report:</p>
<ol>
<li>What&#39;s their Talent Density action, and what&#39;s the one thing I&#39;ll do?</li>
<li>What&#39;s their Cultural Momentum action, and what&#39;s the one thing I&#39;ll do?</li>
<li>Do the two actions conflict? If so, which takes priority?</li>
<li>What&#39;s the trend against last quarter: improving, stable or declining?</li>
<li>What am I committing to do differently this quarter, and is it written down as an action?</li>
</ol>
<h2>Checklist for the cycle</h2>
<ul>
<li><input disabled="" type="checkbox"> Goals and key metrics current for every report before the cycle opens</li>
<li><input disabled="" type="checkbox"> Results recorded (hit / missed) for every key metric</li>
<li><input disabled="" type="checkbox"> Every section rated, revealed and responded to; submitted by the Ready to Meet date</li>
<li><input disabled="" type="checkbox"> Review shared with the person before the 1:1</li>
<li><input disabled="" type="checkbox"> 1:1 booked (calendar link), card moved to Meeting Scheduled</li>
<li><input disabled="" type="checkbox"> Meeting run from the meeting page; notes saved; actions added with owners and dates; Complete Meeting clicked by the Meeting Complete date</li>
<li><input disabled="" type="checkbox"> Results sent by the Results Sent date</li>
<li><input disabled="" type="checkbox"> Analysis checked: anything in Rating vs results or the By manager row to act on?</li>
</ul>$res$, true, 30, ARRAY['MANAGER','AREA_LEAD','LEADERSHIP','ADMIN']::"Role"[],
       (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1), now(), now()
WHERE EXISTS (SELECT 1 FROM "User" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "Resource" WHERE "slug" = 'manager-guide');

INSERT INTO "Resource" ("id", "title", "slug", "content", "published", "sortOrder", "allowedRoles", "createdById", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, $res$Setting up Goals and Key Metrics$res$, 'goals-and-key-metrics', $res$<p>Goals and key metrics are the inputs that ground every cycle. Results are recorded against them before anyone rates anything, so the 1:1 starts from shared facts rather than memory. This guide covers what goes where, who sets what, and how results flow into the review.</p>
<h2>What goes where</h2>
<p><strong>Key metrics</strong> are recurring performance targets for the role: the things you&#39;d expect to look at every quarter (revenue retained, response time, on-time delivery, throughput). Set them once and revisit when the role changes. Each has a name, a target and an optional unit.</p>
<p><strong>Goals</strong> are time-bound commitments agreed between a manager and a team member: specific things being worked towards this quarter or the next few. Each has a title, an optional description and due date. Closed when done, replaced as priorities shift.</p>
<p>Aim for <strong>3–5 key metrics</strong> and <strong>2–4 active goals</strong> per person. Fewer is usually better; if everything is a priority, nothing is.</p>
<h2>Who sets them</h2>
<table>
<thead>
<tr>
<th>Set by</th>
<th>How</th>
<th>Label shown</th>
</tr>
</thead>
<tbody><tr>
<td><strong>The team member</strong></td>
<td><strong>Goals &amp; Metrics</strong> in the sidebar: add goals and key metrics for yourself</td>
<td><em>Set by employee</em></td>
</tr>
<tr>
<td><strong>Their manager</strong></td>
<td><strong>My Team → View Profile → Add Goal / Add Metric</strong></td>
<td><em>Set by manager</em></td>
</tr>
<tr>
<td><strong>An admin, for a job role</strong></td>
<td><strong>Admin → Roles &amp; Templates</strong>: attach metric and goal templates to a job title</td>
<td><em>Role-set</em></td>
</tr>
</tbody></table>
<p>Role-set items are created automatically for everyone with that job title (and for anyone who later joins it). They can&#39;t be removed or retitled from a person&#39;s page; changes are made on the template and flow to everyone. Notes and progress on a role-set item are still per person.</p>
<p>Everyone can see all three kinds on their own page; managers see them on the report&#39;s profile; both see them inside the assessment forms.</p>
<h2>What good looks like</h2>
<p><strong>Good key metrics</strong> are measurable, owned by the person, and reviewed every quarter:</p>
<ul>
<li><em>Client revenue retained ≥ 95%</em></li>
<li><em>Average response time to client queries &lt; 4 business hours</em></li>
<li><em>Engagement survey score for direct reports ≥ 4.0 / 5</em></li>
<li><em>On-time delivery rate for quarter-end close ≥ 98%</em></li>
</ul>
<p>Avoid vague metrics like &quot;be a good team player&quot; or &quot;improve communication&quot;; those belong in the Values Alignment conversation.</p>
<p><strong>Good goals</strong> are time-bound, specific, and have a clear finish line:</p>
<ul>
<li><em>Migrate the top 10 clients to the new reporting template by 30 June</em></li>
<li><em>Complete Xero advisor certification by end of Q2</em></li>
<li><em>Reduce manual journal entries by 50% by 31 July via the automation rollout</em></li>
<li><em>Hire and onboard two new associates by 30 September</em></li>
</ul>
<p>Avoid goals that are really &quot;do your job&quot;. Goals should represent stretch, change or development, not BAU.</p>
<h2>Recording results during the cycle</h2>
<p>Inside both assessment forms, the <strong>Goals &amp; Key Metrics</strong> panel sits under the Performance section.</p>
<p><strong>Key metrics.</strong> Enter the <strong>actual result</strong> for the quarter, mark it <strong>Hit</strong>, <strong>Missed</strong> or <strong>Unsure</strong> against the target, add a comment if useful, and save. Either the team member or the manager can record or correct a result; there&#39;s one result per metric per cycle. Managers can&#39;t move past the Performance section until every metric has a result.</p>
<p><strong>Goals.</strong> Choose <strong>On track</strong>, <strong>Off track</strong> or <strong>Complete</strong> and add a note. The team member and the manager each keep their own update for the cycle, shown side by side; neither overwrites the other. A manager marking a goal Complete closes the goal; the team member&#39;s update is their own view.</p>
<p><strong>Why hit / missed matters.</strong> The app compares the performance rating with the metric outcomes. A rating of Meeting or above with more metrics missed than hit raises a warning on the form and the summary, and shows under <em>Rating vs results</em> on Analysis. That&#39;s not a rule against it; it&#39;s a prompt to make sure the evidence (or the targets) are right.</p>
<h2>Setting goals for next quarter</h2>
<p>The last section of the self-assessment, <strong>Looking Ahead</strong>, is where the team member adds their goals for the coming quarter as tracked goals. Managers add or adjust goals from the profile page, and should confirm the final set in the 1:1. Actions agreed in the meeting are tasks, not goals; if an action turns into a longer commitment, add it as a goal from the profile page.</p>
<h2>Through the quarter</h2>
<p>Progress doesn&#39;t have to wait for the next cycle. From <strong>Goals &amp; Metrics</strong> (team members) or the profile page (managers), update a goal&#39;s status, add notes, record results as they land, and add or close goals as priorities change. The employee dashboard shows the current cycle&#39;s goals and metrics at all times.</p>
<h2>Do this before the cycle opens</h2>
<p>Get goals and key metrics in place <strong>before the cycle opens</strong>. The cycle-open email goes to everyone at once, and the self-assessment starts with recording results, so empty pages show up immediately.</p>
<p>If you&#39;re not sure what to load for someone, talk it through in your next 1:1. Agreeing on metrics and goals together is itself a useful conversation. For a standard set across a role, send the list to Pat to be set up as role templates.</p>
<h2>Need help?</h2>
<p>Reach out to Pat or post in the managers&#39; Teams channel.</p>$res$, true, 40, ARRAY['EMPLOYEE','MANAGER','AREA_LEAD','LEADERSHIP','ADMIN']::"Role"[],
       (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1), now(), now()
WHERE EXISTS (SELECT 1 FROM "User" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "Resource" WHERE "slug" = 'goals-and-key-metrics');

INSERT INTO "Resource" ("id", "title", "slug", "content", "published", "sortOrder", "allowedRoles", "createdById", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, $res$Admin Guide — Running the Cycle$res$, 'admin-guide', $res$<p>For whoever administers the Performance &amp; Growth app: opening and closing cycles, managing users and job roles, reminders, and what the system does automatically.</p>
<h2>Opening a cycle</h2>
<p><strong>Admin → Assessment Cycles → Create Cycle.</strong></p>
<ol>
<li>Choose the quarter and year.</li>
<li>The three milestone dates prefill from the period: Ready to Meet on the 10th, Meeting Complete on the 20th, Results Sent on the 25th of the month after the quarter ends (Q2 lands a month later because of the financial-year close). Change any of them before creating; they must stay in order.</li>
<li>Click <strong>Create Cycle</strong>.</li>
</ol>
<p>Creating a cycle:</p>
<ul>
<li>creates a self-assessment for every active user and a manager assessment for everyone who has a manager;</li>
<li>emails every active user that the cycle is open, with the dates;</li>
<li>puts the dates on everyone&#39;s dashboard timeline and the managers&#39; boards, and uses them for reminders.</li>
</ul>
<p>Only one cycle should normally be open at a time. Close the previous one first (toggle on its row) so reminders and the &quot;current cycle&quot; views don&#39;t split.</p>
<h2>Adjusting dates after opening</h2>
<p>Expand a cycle&#39;s row. The three dates are editable at the top; <strong>Save dates</strong> applies them everywhere at once. Leaving a date blank restores the default.</p>
<h2>Watching progress</h2>
<p>The expanded row shows counts (pending, in progress, ready to send, results sent) and a board of every person by status, with dots for self-assessment submitted, manager assessment submitted and review shared. Click a name to open their summary.</p>
<p>For the fuller picture use <strong>Analysis → By manager</strong>: reviews submitted against each manager&#39;s reports, averages, share in the top tier, edits after submission, ratings adjusted after reading the self-assessment, and rating-versus-results disconnects.</p>
<h2>Reminders</h2>
<p>The app sends reminder emails on <strong>Sunday and Monday mornings</strong> while a cycle is open, one per person per kind per day:</p>
<ul>
<li>team members with no self-assessment submitted, against the Ready to Meet date;</li>
<li>managers with reviews not submitted (Ready to Meet), reviews submitted but not shared and 1:1s not held (Meeting Complete), and results not sent (Results Sent).</li>
</ul>
<p>Three days past a milestone, the manager&#39;s manager is copied in.</p>
<p><strong>Send reminders now</strong> on the Assessment Cycles page sends the same set immediately, ignoring the weekday rule but not the once-a-day rule. Use it after opening a cycle late or before a deadline.</p>
<h2>Event emails</h2>
<p>These go out automatically; nothing to configure:</p>
<table>
<thead>
<tr>
<th>Event</th>
<th>Who is emailed</th>
</tr>
</thead>
<tbody><tr>
<td>Cycle opened</td>
<td>Everyone active</td>
</tr>
<tr>
<td>Self-assessment submitted</td>
<td>The person&#39;s manager</td>
</tr>
<tr>
<td>Review shared</td>
<td>The team member, with a calendar link for the 1:1</td>
</tr>
<tr>
<td>Review changed after sharing</td>
<td>The team member (at most once a day)</td>
</tr>
<tr>
<td>Meeting marked complete</td>
<td>Both the team member and the manager</td>
</tr>
</tbody></table>
<p>Each is sent once; a resend of the same action doesn&#39;t produce a second email.</p>
<h2>Closing a cycle</h2>
<p>Toggle the cycle to <strong>CLOSED</strong> once results are sent for everyone (or the Results Sent date has passed). Closing stops reminders and new assessments from being started; existing assessments can still be edited by their owners, with every change logged. Reopen if needed. <strong>Delete</strong> removes the cycle and all its assessments and cannot be undone.</p>
<h2>Users</h2>
<p><strong>Admin → User Management.</strong></p>
<ul>
<li><strong>Invite User</strong> creates an invitation and emails a link to set a password. The person appears under <em>Pending invitations</em> until they register, then under <em>All users</em>. <em>Send Email</em> resends; <em>Copy Link</em> lets you send it yourself.</li>
<li><strong>Bulk Import</strong> takes a CSV or pasted spreadsheet rows (name, email, role, job title, team, manager email).</li>
<li><strong>Copy Join Link</strong> gives a self-registration link for people without an invitation.</li>
<li>On each user row you can edit job title, team, start date, access role (Employee, Manager, Area Lead, Leadership, Admin), manager, active status, set a password, or delete.</li>
<li>Search by name or email; filter by role, team, manager or status; sort. Filters are kept in the page address so a view can be shared.</li>
</ul>
<p><strong>Job titles double as job roles.</strong> Setting a job title links the person to that role (creating the role if new) and gives them any role-set goals and metrics. Pick an existing title from the suggestions where possible so people land in the same role rather than near-duplicates.</p>
<p><strong>Deactivating</strong> a user keeps their history but removes them from cycles, boards and reminders. Deleting removes everything.</p>
<h2>Roles &amp; Templates</h2>
<p><strong>Admin → Roles &amp; Templates.</strong></p>
<ul>
<li>Roles are created automatically from job titles; add one by hand if you&#39;re setting it up ahead of hiring.</li>
<li><strong>Role-set metrics</strong>: name, target, unit, notes, optionally only for one team. Saving creates a key metric for everyone active in the role; edits propagate; deactivating removes instances that never had a result (those with results stay as history).</li>
<li><strong>Role-set goals</strong>: title, description, optional &quot;due in N days&quot;, optionally only for one team. Saving creates a goal for everyone in the role; deactivating cancels the active instances.</li>
<li>New joiners, role changes and reactivations pick up the role&#39;s templates automatically.</li>
</ul>
<p>People can&#39;t remove or retitle role-set items from their own pages; changes happen here.</p>
<h2>Access roles</h2>
<table>
<thead>
<tr>
<th>Role</th>
<th>Sees</th>
</tr>
</thead>
<tbody><tr>
<td><strong>Employee</strong></td>
<td>Own dashboard, self-assessment, My Reviews, goals, tasks, resources</td>
</tr>
<tr>
<td><strong>Manager</strong></td>
<td>The above plus their direct reports: board, assessments, summaries, meetings, profiles, Analysis for their reports</td>
</tr>
<tr>
<td><strong>Area Lead</strong></td>
<td>As Manager, plus all managers&#39; reports</td>
</tr>
<tr>
<td><strong>Leadership</strong></td>
<td>Everyone&#39;s assessments, summaries and Analysis; can correct any review (logged)</td>
</tr>
<tr>
<td><strong>Admin</strong></td>
<td>Everything, plus cycles, users, roles and resources</td>
</tr>
</tbody></table>
<h2>Resources</h2>
<p><strong>Resources</strong> holds guides like this one. Create or edit them with the built-in editor, choose which roles can see each one, and publish. Pasting from a formatted document keeps headings, lists and tables.</p>
<h2>Audit trail</h2>
<p>Every edit to a submitted assessment, every unlock, share and send is recorded with who, when and what changed. Managers and leadership see it at the bottom of the summary page; team members see the history of their own self-assessment on My Reviews.</p>$res$, true, 50, ARRAY['LEADERSHIP','ADMIN']::"Role"[],
       (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1), now(), now()
WHERE EXISTS (SELECT 1 FROM "User" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "Resource" WHERE "slug" = 'admin-guide');

INSERT INTO "Resource" ("id", "title", "slug", "content", "published", "sortOrder", "allowedRoles", "createdById", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, $res$Cycle Quick Reference$res$, 'cycle-quick-reference', $res$<p>One page: who does what, when, and what each status means.</p>
<h2>The sequence</h2>
<table>
<thead>
<tr>
<th>Step</th>
<th>Team member</th>
<th>Manager</th>
<th>Status on the board</th>
</tr>
</thead>
<tbody><tr>
<td>Cycle opens</td>
<td>Check goals and key metrics are current</td>
<td>Check every report&#39;s goals and metrics</td>
<td>In Assessment</td>
</tr>
<tr>
<td>Record results</td>
<td>Enter actual results, mark hit / missed, update goal progress</td>
<td>Confirm results, add your goal updates</td>
<td>In Assessment</td>
</tr>
<tr>
<td>Assess</td>
<td>Complete the five sections, submit</td>
<td>Rate each section blind, reveal, respond, submit</td>
<td>In Assessment → <strong>Ready to Meet</strong></td>
</tr>
<tr>
<td>Share</td>
<td>Read the review on My Reviews before the 1:1</td>
<td><strong>Share review</strong></td>
<td>Ready to Meet</td>
</tr>
<tr>
<td>Book</td>
<td></td>
<td>Calendar link; drag card to Meeting Scheduled</td>
<td><strong>Meeting Scheduled</strong></td>
</tr>
<tr>
<td>1:1</td>
<td>Walk through your self-assessment, discuss the gaps, agree actions</td>
<td>Run from the meeting page; notes and actions; <strong>Complete Meeting</strong></td>
<td><strong>Meeting Complete</strong></td>
</tr>
<tr>
<td>Close out</td>
<td>Read notes and actions on My Reviews and Tasks</td>
<td><strong>Send Results</strong></td>
<td><strong>Review Complete</strong></td>
</tr>
<tr>
<td>Through the quarter</td>
<td>Work the actions; keep goals current</td>
<td>Work the actions; Review and Planning with People</td>
<td></td>
</tr>
</tbody></table>
<h2>The dates</h2>
<p>Each cycle has three milestone dates, set when it&#39;s opened and shown on the dashboard timeline:</p>
<ul>
<li><strong>Ready to Meet</strong>: both assessments submitted.</li>
<li><strong>Meeting Complete</strong>: 1:1 held and marked complete.</li>
<li><strong>Results Sent</strong>: results sent, cycle closed.</li>
</ul>
<p>Reminder emails go out Sunday and Monday mornings for anything outstanding; a manager&#39;s manager is copied three days past a milestone.</p>
<h2>The five sections</h2>
<p>Performance · Growth Readiness · Values Alignment (four values) · Engagement · Looking Ahead. Each rating is 1–3. Submit needs every rating set.</p>
<h2>Rating labels</h2>
<table>
<thead>
<tr>
<th></th>
<th>1</th>
<th>2</th>
<th>3</th>
</tr>
</thead>
<tbody><tr>
<td>Performance, Values, Engagement</td>
<td>Below</td>
<td>Meeting</td>
<td>Exceeding</td>
</tr>
<tr>
<td>Growth Readiness</td>
<td>Developing</td>
<td>Building</td>
<td>Ready Now</td>
</tr>
</tbody></table>
<h2>Placements and tiers</h2>
<p><strong>Talent Density</strong> (Performance × Growth) and <strong>Cultural Momentum</strong> (Values × Engagement), nine boxes each, every box with a prescribed action. Tiers: <strong>Top</strong> = Ready to Promote, Stretch &amp; Develop, Expand the Role · <strong>Medium</strong> = Keep Growing, Deepen the Expertise, Remove the Blockers · <strong>Low</strong> = Intervene Now, Build the Foundations, Maintain &amp; Recognise.</p>
<h2>Badges you&#39;ll see</h2>
<table>
<thead>
<tr>
<th>Badge</th>
<th>Meaning</th>
</tr>
</thead>
<tbody><tr>
<td><strong>Submitted</strong></td>
<td>Self-assessment is in</td>
</tr>
<tr>
<td><strong>Not yet shared</strong> / <strong>Shared</strong></td>
<td>Whether the manager&#39;s review is visible to the team member yet</td>
</tr>
<tr>
<td><strong>Shared ahead of 1:1</strong></td>
<td>Review shared; read it before the meeting</td>
</tr>
<tr>
<td><strong>Updated since shared</strong></td>
<td>A rating or comment changed after sharing; re-read</td>
</tr>
<tr>
<td><strong>Review Complete</strong></td>
<td>Results sent; cycle closed for this person</td>
</tr>
<tr>
<td><strong>Role-set</strong></td>
<td>Goal or metric attached to the job title; managed by admin</td>
</tr>
<tr>
<td><strong>Set by employee</strong> / <strong>Set by manager</strong></td>
<td>Who created the goal or metric</td>
</tr>
<tr>
<td><strong>Hit</strong> / <strong>Missed</strong></td>
<td>Metric result against target for the cycle</td>
</tr>
</tbody></table>
<h2>Where to go</h2>
<p>Dashboard · Goals &amp; Metrics · My Reviews · Tasks · Resources — and for managers, My Team and Analysis.</p>
<h2>Questions</h2>
<p>Ask your manager first for anything about your review. For the app itself, Pat.</p>$res$, true, 60, ARRAY['EMPLOYEE','MANAGER','AREA_LEAD','LEADERSHIP','ADMIN']::"Role"[],
       (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1), now(), now()
WHERE EXISTS (SELECT 1 FROM "User" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "Resource" WHERE "slug" = 'cycle-quick-reference');
