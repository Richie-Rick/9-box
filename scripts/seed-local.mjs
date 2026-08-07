// Local-review seed. Run: node scripts/seed-local.mjs (requires LOCAL_PG env / local Postgres)
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || "postgresql://ninebox:ninebox@localhost:5432/ninebox" });
const prisma = new PrismaClient({ adapter });

const PW = await bcrypt.hash("Password123!", 10);

async function user(email, name, role, extra = {}) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash: PW, role, ...extra },
  });
}

async function main() {
  // --- People ---
  const admin = await user("admin@visory.test", "Ava Admin", "ADMIN", { jobTitle: "People Ops Lead", team: "Operations" });
  const leader = await user("lead@visory.test", "Lena Leadership", "LEADERSHIP", { jobTitle: "Chief Operating Officer", team: "Executive" });
  const areaLead = await user("arealead@visory.test", "Aaron Arealead", "AREA_LEAD", { jobTitle: "Head of Delivery", team: "Delivery", managerId: leader.id, startDate: new Date("2022-03-14") });
  const manager = await user("manager@visory.test", "Morgan Manager", "MANAGER", { jobTitle: "Bookkeeping Team Lead", team: "Bookkeeping", managerId: areaLead.id, startDate: new Date("2023-01-09") });

  const evan = await user("employee@visory.test", "Evan Employee", "EMPLOYEE", { jobTitle: "Senior Bookkeeper", team: "Bookkeeping", managerId: manager.id, startDate: new Date("2023-08-21") });
  const priya = await user("priya@visory.test", "Priya Patel", "EMPLOYEE", { jobTitle: "Bookkeeper", team: "Bookkeeping", managerId: manager.id, startDate: new Date("2024-11-04") });
  const marcus = await user("marcus@visory.test", "Marcus Webb", "EMPLOYEE", { jobTitle: "Payroll Specialist", team: "Bookkeeping", managerId: manager.id, startDate: new Date("2025-02-17") });
  const sofia = await user("sofia@visory.test", "Sofia Reyes", "EMPLOYEE", { jobTitle: "Junior Bookkeeper", team: "Bookkeeping", managerId: manager.id, startDate: new Date("2026-04-01") });

  // --- Cycles: Q1+Q2 2026 closed, Q3 open ---
  async function cycle(quarter, year, status) {
    const found = await prisma.assessmentCycle.findFirst({ where: { quarter, year } });
    if (found) return found;
    return prisma.assessmentCycle.create({ data: { quarter, year, status } });
  }
  const q1 = await cycle(1, 2026, "CLOSED");
  const q2 = await cycle(2, 2026, "CLOSED");
  const q3 = await cycle(3, 2026, "OPEN");

  const vals = (a, b, c, d) => ({ valCustomerFirst: a, valStepIntoArena: b, valFlockToProblems: c, valGiveEnergy: d });

  // --- Q3 (open cycle) assessments in varied states ---
  // Evan: full flow complete — self + manager submitted, meeting complete, results sent
  const evanSelf = await prisma.selfAssessment.upsert({
    where: { cycleId_employeeId: { cycleId: q3.id, employeeId: evan.id } },
    update: {},
    create: {
      cycleId: q3.id, employeeId: evan.id, performance: 3,
      performanceJustification: "Closed the月-end backlog two days early each month this quarter and took on the Fairview account solo.",
      achievements: "Cleared the Fairview migration, mentored Sofia through her first BAS cycle, cut rework on my accounts by half.",
      blockers: "Client document turnaround is still slow; chasing paperwork eats several hours a week.",
      learning: "Completed the Xero advanced payroll certification.",
      ...vals(3, 3, 2, 3),
      valuesReflection: "Proudest of jumping on the Fairview escalation before it reached the client.",
      engagement: 3, engagementDriver: "Ownership of bigger accounts and the mentoring work.",
      supportNeeded: "Would value a clearer path to the senior/lead role conversation.",
      goalsNextMonth: "Take over the two new mid-market accounts and document the month-end checklist.",
      submittedAt: new Date("2026-07-28T09:15:00Z"),
    },
  });
  const evanMgr = await prisma.managerAssessment.upsert({
    where: { cycleId_managerId_employeeId: { cycleId: q3.id, managerId: manager.id, employeeId: evan.id } },
    update: {},
    create: {
      cycleId: q3.id, managerId: manager.id, employeeId: evan.id,
      performance: 3, performanceEvidence: "Consistently ahead of month-end deadlines; Fairview migration delivered clean with zero client escalations.",
      growthReadiness: 3, growthReadinessEvidence: "Already operating at the next level — mentoring Sofia, running client calls without support.",
      ...vals(3, 3, 3, 3),
      valuesEvidence: "Flocked to the Fairview problem unprompted; energises the team standups.",
      engagement: 3, engagementEvidence: "High energy, asking for more scope.",
      trend: "IMPROVING",
      notes: "Ready for the promotion conversation this quarter.",
      submittedAt: new Date("2026-07-30T02:00:00Z"),
      resultsSentAt: new Date("2026-08-04T05:30:00Z"),
      meetingStatus: "MEETING_COMPLETE",
    },
  });
  const evanMeeting = await prisma.meeting.upsert({
    where: { managerAssessmentId: evanMgr.id },
    update: {},
    create: {
      managerAssessmentId: evanMgr.id,
      notes: "Great conversation. Agreed to start the promotion case for senior lead. Evan to draft the month-end playbook.",
      startedAt: new Date("2026-08-03T23:00:00Z"), completedAt: new Date("2026-08-03T23:45:00Z"),
    },
  });

  // Priya: self submitted, manager assessment still draft (NOT_READY)
  await prisma.selfAssessment.upsert({
    where: { cycleId_employeeId: { cycleId: q3.id, employeeId: priya.id } },
    update: {},
    create: {
      cycleId: q3.id, employeeId: priya.id, performance: 2,
      performanceJustification: "Hit most deadlines; two late lodgements in June due to client delays.",
      achievements: "Took on three new clients and kept CSAT above target.",
      blockers: "Workpaper templates are inconsistent between clients.",
      learning: "Started the payroll fundamentals course.",
      ...vals(3, 2, 2, 2),
      valuesReflection: "Trying to speak up earlier when things slip.",
      engagement: 2, engagementDriver: "Enjoy the client contact; admin load is wearing.",
      supportNeeded: "Help standardising workpapers.",
      goalsNextMonth: "Finish payroll course; zero late lodgements.",
      submittedAt: new Date("2026-08-01T10:00:00Z"),
    },
  });
  await prisma.managerAssessment.upsert({
    where: { cycleId_managerId_employeeId: { cycleId: q3.id, managerId: manager.id, employeeId: priya.id } },
    update: {},
    create: {
      cycleId: q3.id, managerId: manager.id, employeeId: priya.id,
      performance: 2, performanceEvidence: "Solid quarter overall; June lodgements slipped.",
      meetingStatus: "NOT_READY",
    },
  });

  // Marcus: both submitted, READY_TO_MEET
  await prisma.selfAssessment.upsert({
    where: { cycleId_employeeId: { cycleId: q3.id, employeeId: marcus.id } },
    update: {},
    create: {
      cycleId: q3.id, employeeId: marcus.id, performance: 2,
      performanceJustification: "All pay runs on time; one misconfigured super rate caught in review.",
      achievements: "Automated the timesheet import for two clients.",
      blockers: "Waiting on access to the new payroll platform sandbox.",
      learning: "Shadowed Evan on month-end close.",
      ...vals(2, 3, 3, 2),
      valuesReflection: "Stepped into the arena on the platform migration testing.",
      engagement: 3, engagementDriver: "The automation work is exactly what I want to do more of.",
      supportNeeded: "Sandbox access, and time boxed for automation work.",
      goalsNextMonth: "Automate two more clients' imports.",
      submittedAt: new Date("2026-08-02T11:30:00Z"),
    },
  });
  await prisma.managerAssessment.upsert({
    where: { cycleId_managerId_employeeId: { cycleId: q3.id, managerId: manager.id, employeeId: marcus.id } },
    update: {},
    create: {
      cycleId: q3.id, managerId: manager.id, employeeId: marcus.id,
      performance: 2, performanceEvidence: "Reliable pay runs; the super-rate miss was caught internally, no client impact.",
      growthReadiness: 3, growthReadinessEvidence: "The automation initiative shows real headroom.",
      ...vals(2, 3, 3, 2),
      valuesEvidence: "Volunteered for migration testing before being asked.",
      engagement: 3, engagementEvidence: "Visibly energised by the automation projects.",
      trend: "IMPROVING", notes: "Channel the automation energy; watch detail under load.",
      submittedAt: new Date("2026-08-05T01:00:00Z"),
      meetingStatus: "READY_TO_MEET",
    },
  });

  // Sofia: low ratings, MEETING_SCHEDULED, active PIP
  await prisma.selfAssessment.upsert({
    where: { cycleId_employeeId: { cycleId: q3.id, employeeId: sofia.id } },
    update: {},
    create: {
      cycleId: q3.id, employeeId: sofia.id, performance: 1,
      performanceJustification: "Struggled with reconciliation volume; several corrections needed.",
      achievements: "Completed onboarding modules; first solo BAS with Evan's help.",
      blockers: "Still building speed on the chart of accounts.",
      learning: "Daily reconciliation practice with Evan.",
      ...vals(2, 1, 2, 2),
      valuesReflection: "Need to ask for help earlier instead of sitting on problems.",
      engagement: 2, engagementDriver: "Team is supportive but I feel behind.",
      supportNeeded: "More structured check-ins while I ramp.",
      goalsNextMonth: "Error-free reconciliations for my two smallest clients.",
      submittedAt: new Date("2026-08-03T09:00:00Z"),
    },
  });
  const sofiaMgr = await prisma.managerAssessment.upsert({
    where: { cycleId_managerId_employeeId: { cycleId: q3.id, managerId: manager.id, employeeId: sofia.id } },
    update: {},
    create: {
      cycleId: q3.id, managerId: manager.id, employeeId: sofia.id,
      performance: 1, performanceEvidence: "Error rate above the ramp benchmark at the four-month mark; rework needed on three accounts.",
      growthReadiness: 2, growthReadinessEvidence: "Learning attitude is good; pace of improvement needs to lift.",
      ...vals(2, 1, 2, 2),
      valuesEvidence: "Holds problems too long before flagging them.",
      engagement: 2, engagementEvidence: "Engaged but anxious about the gap.",
      trend: "STABLE", notes: "Structured 30-day plan agreed; daily reviews with Evan.",
      submittedAt: new Date("2026-08-04T03:00:00Z"),
      meetingStatus: "MEETING_SCHEDULED",
    },
  });

  // --- Q2 history for Evan (closed cycle) ---
  await prisma.selfAssessment.upsert({
    where: { cycleId_employeeId: { cycleId: q2.id, employeeId: evan.id } },
    update: {},
    create: {
      cycleId: q2.id, employeeId: evan.id, performance: 2,
      performanceJustification: "Steady quarter; picked up the Fairview account mid-cycle.",
      achievements: "Smooth EOFY close across my book.",
      blockers: "Fairview handover documentation was thin.",
      learning: "EOFY payroll finalisation process.",
      ...vals(3, 2, 2, 3),
      valuesReflection: "Kept the team steady through EOFY crunch.",
      engagement: 2, engagementDriver: "EOFY load was heavy but manageable.",
      supportNeeded: "Earlier heads-up on account handovers.",
      goalsNextMonth: "Stabilise Fairview.",
      submittedAt: new Date("2026-04-28T09:00:00Z"),
    },
  });
  const evanMgrQ2 = await prisma.managerAssessment.upsert({
    where: { cycleId_managerId_employeeId: { cycleId: q2.id, managerId: manager.id, employeeId: evan.id } },
    update: {},
    create: {
      cycleId: q2.id, managerId: manager.id, employeeId: evan.id,
      performance: 2, performanceEvidence: "Reliable EOFY delivery; absorbed Fairview without dropping the ball.",
      growthReadiness: 2, growthReadinessEvidence: "Showing lead behaviours in standups.",
      ...vals(3, 2, 2, 3),
      valuesEvidence: "Customer-first through the EOFY crunch.",
      engagement: 2, engagementEvidence: "Tired post-EOFY but positive.",
      trend: "IMPROVING", notes: "Watch load; earmark for stretch next quarter.",
      submittedAt: new Date("2026-05-02T02:00:00Z"),
      resultsSentAt: new Date("2026-05-06T02:00:00Z"),
      meetingStatus: "MEETING_COMPLETE",
    },
  });

  // --- Goals & metrics ---
  async function goal(employeeId, title, description, dueDate, status = "ACTIVE") {
    const found = await prisma.goal.findFirst({ where: { employeeId, title } });
    if (found) return found;
    return prisma.goal.create({ data: { employeeId, createdById: manager.id, title, description, dueDate, status } });
  }
  const g1 = await goal(evan.id, "Document the month-end close playbook", "Repeatable checklist covering all recurring clients, handover-ready.", new Date("2026-09-30"));
  const g2 = await goal(evan.id, "Mentor Sofia to independent reconciliations", "Daily reviews tapering to weekly by end of quarter.", new Date("2026-09-15"));
  const g3 = await goal(evan.id, "Complete Xero advanced certification", null, new Date("2026-06-30"), "COMPLETED");
  const g4 = await goal(priya.id, "Standardise workpaper templates", "One template set across all assigned clients.", new Date("2026-10-31"));
  const g5 = await goal(marcus.id, "Automate timesheet imports for four clients", "Extend the June automation to the rest of the payroll book.", new Date("2026-09-30"));
  const g6 = await goal(sofia.id, "Error-free reconciliations on two smallest clients", "Zero corrections for two consecutive months.", new Date("2026-09-05"));

  async function gUpdate(goalId, cycleId, status, note) {
    return prisma.goalUpdate.upsert({
      where: { goalId_cycleId: { goalId, cycleId } },
      update: {},
      create: { goalId, cycleId, status, note, createdById: manager.id },
    });
  }
  await gUpdate(g1.id, q3.id, "ON_TRACK", "First six clients documented.");
  await gUpdate(g2.id, q3.id, "ON_TRACK", "Sofia now solo on the two smallest accounts.");
  await gUpdate(g3.id, q2.id, "COMPLETE", "Certified in June.");
  await gUpdate(g5.id, q3.id, "OFF_TRACK", "Blocked on sandbox access.");
  await gUpdate(g6.id, q3.id, "OFF_TRACK", "Two corrections in July.");

  async function metric(employeeId, name, target, unit) {
    const found = await prisma.keyMetric.findFirst({ where: { employeeId, name } });
    if (found) return found;
    return prisma.keyMetric.create({ data: { employeeId, createdById: manager.id, name, target, unit } });
  }
  const m1 = await metric(evan.id, "Month-end close time", "3", "days");
  const m2 = await metric(evan.id, "Rework rate", "<5", "%");
  const m3 = await metric(priya.id, "On-time lodgements", "100", "%");
  const m4 = await metric(marcus.id, "Pay runs on time", "100", "%");
  const m5 = await metric(sofia.id, "Reconciliation error rate", "<3", "%");
  async function mResult(keyMetricId, cycleId, actual, note) {
    return prisma.metricResult.upsert({
      where: { keyMetricId_cycleId: { keyMetricId, cycleId } },
      update: {},
      create: { keyMetricId, cycleId, actual, note, createdById: manager.id },
    });
  }
  await mResult(m1.id, q3.id, "2.5", "Best quarter yet.");
  await mResult(m1.id, q2.id, "3", null);
  await mResult(m2.id, q3.id, "3", null);
  await mResult(m3.id, q3.id, "92", "Two late in June.");
  await mResult(m4.id, q3.id, "100", null);
  await mResult(m5.id, q3.id, "7", "Trending down from 11% in May.");

  // --- Tasks ---
  async function task(data) {
    const found = await prisma.task.findFirst({ where: { employeeId: data.employeeId, title: data.title } });
    if (found) return found;
    return prisma.task.create({ data });
  }
  const t1 = await task({ title: "Draft promotion case for Evan", employeeId: evan.id, assigneeId: manager.id, createdById: manager.id, meetingId: evanMeeting.id, dueDate: new Date("2026-08-21"), status: "IN_PROGRESS", visibility: "MANAGER_ONLY" });
  const t2 = await task({ title: "Draft month-end close playbook (first 6 clients)", employeeId: evan.id, assigneeId: evan.id, createdById: manager.id, meetingId: evanMeeting.id, dueDate: new Date("2026-08-29"), status: "TODO", visibility: "SHARED" });
  const t3 = await task({ title: "Request payroll sandbox access for Marcus", employeeId: marcus.id, assigneeId: manager.id, createdById: manager.id, dueDate: new Date("2026-08-10"), status: "TODO", visibility: "SHARED" });
  const t4 = await task({ title: "30-day reconciliation improvement plan", description: "Daily reviews with Evan, weekly checkpoint with Morgan, error-rate target <3% by day 30.", employeeId: sofia.id, assigneeId: manager.id, createdById: manager.id, dueDate: new Date("2026-09-05"), status: "IN_PROGRESS", visibility: "MANAGER_ONLY", type: "PIP" });
  await prisma.taskComment.createMany({
    data: [
      { taskId: t2.id, authorId: evan.id, body: "Three clients documented so far — on track for the 29th." },
      { taskId: t2.id, authorId: manager.id, body: "Great. Add the BAS edge cases from Fairview when you get to it." },
    ],
    skipDuplicates: true,
  });

  // --- Performance plan for Sofia (from PIP task) ---
  const plan = await prisma.performancePlan.upsert({
    where: { taskId: t4.id },
    update: {},
    create: { taskId: t4.id, employeeId: sofia.id, managerId: manager.id, status: "ACTIVE", summary: "Lift reconciliation accuracy to benchmark within 30 days with daily support." },
  });
  const pmFound = await prisma.performanceMeeting.findFirst({ where: { planId: plan.id } });
  const pm = pmFound || await prisma.performanceMeeting.create({
    data: { planId: plan.id, title: "PIP kickoff", notes: "Agreed daily review cadence and the two-client focus.", meetingDate: new Date("2026-08-05T23:00:00Z") },
  });
  if (!pmFound) {
    await prisma.performanceAction.createMany({
      data: [
        { meetingId: pm.id, title: "Set up daily 15-min review with Evan", done: true, dueDate: new Date("2026-08-07") },
        { meetingId: pm.id, title: "Chart-of-accounts refresher module", done: false, dueDate: new Date("2026-08-14") },
        { meetingId: pm.id, title: "Week-2 checkpoint with Morgan", done: false, dueDate: new Date("2026-08-19") },
      ],
    });
  }

  // --- Review notes ---
  const rnFound = await prisma.reviewNote.findFirst({ where: { cycleId: q3.id, employeeId: evan.id } });
  if (!rnFound) {
    await prisma.reviewNote.createMany({
      data: [
        { cycleId: q3.id, employeeId: evan.id, authorId: manager.id, kind: "NOTE", title: "Client praise", body: "Fairview CFO emailed unprompted praise about the migration." },
        { cycleId: q3.id, employeeId: evan.id, authorId: evan.id, kind: "MEETING_LINK", title: "Q3 review call", url: "https://meet.google.com/abc-defg-hij" },
        { cycleId: q3.id, employeeId: sofia.id, authorId: manager.id, kind: "SUMMARY", title: "Ramp check-in summary", body: "Discussed error trends; agreed on daily reviews." },
      ],
    });
  }

  // --- Resources ---
  async function resource(slug, title, content, published, sortOrder, allowedRoles) {
    return prisma.resource.upsert({
      where: { slug },
      update: {},
      create: { slug, title, content, published, sortOrder, createdById: admin.id, ...(allowedRoles ? { allowedRoles } : {}) },
    });
  }
  await resource("running-a-great-review", "Running a great review conversation", "<h2>Before the meeting</h2><p>Read the self-assessment fully. Note where your ratings differ and why.</p><h2>In the meeting</h2><p>Start with their reflection, not your scores. Agree actions before discussing ratings.</p>", true, 1, ["MANAGER", "AREA_LEAD", "LEADERSHIP", "ADMIN"]);
  await resource("understanding-the-9-box", "Understanding the 9-box model", "<p>We assess on two grids: <strong>Performance × Growth Readiness</strong> and <strong>Values × Engagement</strong>. Each cell carries a prescribed action.</p><ul><li>Ratings are 1–3 on each axis</li><li>Placement drives the conversation, not the other way round</li></ul>", true, 2, null);
  await resource("writing-a-self-assessment", "Writing a useful self-assessment", "<p>Be specific. \"Closed month-end two days early each month\" beats \"worked hard\". Include blockers — they drive the support conversation.</p>", true, 3, null);
  await resource("draft-pip-guide", "PIP guide (draft)", "<p>Draft — not yet published.</p>", false, 4, ["MANAGER", "AREA_LEAD", "LEADERSHIP", "ADMIN"]);

  // --- Pending invitation ---
  const invFound = await prisma.invitation.findFirst({ where: { email: "newhire@visory.test" } });
  if (!invFound) {
    await prisma.invitation.create({
      data: { email: "newhire@visory.test", name: "Nina Newhire", jobTitle: "Bookkeeper", team: "Bookkeeping", role: "EMPLOYEE", managerId: manager.id, token: "seed-invite-token-nina-123" },
    });
  }

  console.log("Seed complete.");
  console.log("Logins (password for all: Password123!):");
  for (const u of [admin, leader, areaLead, manager, evan, priya, marcus, sofia]) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
}

main().finally(() => prisma.$disconnect());
