import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { getCycleDueDates } from "@/lib/utils";
import { notifyCycleOpened } from "@/lib/notifications";

// Parses an optional yyyy-mm-dd (or ISO) date from the client; undefined when
// absent, null when blank, else a Date (end of that local day is not needed:
// the Kanban and reminders compare by day).
function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function milestonesInOrder(dates: { readyToMeet: Date; meetingComplete: Date; resultsSent: Date }): boolean {
  return dates.readyToMeet <= dates.meetingComplete && dates.meetingComplete <= dates.resultsSent;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cycles = await prisma.assessmentCycle.findMany({
    orderBy: [{ year: "desc" }, { quarter: "desc" }, { month: "desc" }],
  });

  return NextResponse.json(cycles);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { quarter, year, readyToMeetDueAt, meetingDueAt, resultsDueAt } = await request.json();

  if (!quarter || !year || quarter < 1 || quarter > 4) {
    return NextResponse.json({ error: "Valid quarter (1-4) and year are required" }, { status: 400 });
  }

  // Milestone dates: the admin's choice, defaulting from the period.
  const defaults = getCycleDueDates({ quarter, year });
  const milestones = {
    readyToMeet: parseDate(readyToMeetDueAt) ?? defaults.readyToMeet,
    meetingComplete: parseDate(meetingDueAt) ?? defaults.meetingComplete,
    resultsSent: parseDate(resultsDueAt) ?? defaults.resultsSent,
  };
  if (!milestonesInOrder(milestones)) {
    return NextResponse.json({ error: "Milestones must be in order: Ready to Meet, then Meeting Complete, then Results Sent" }, { status: 400 });
  }

  // Uniqueness per period is enforced here (no DB unique constraint) so legacy
  // monthly cycles can coexist with quarterly ones.
  const existing = await prisma.assessmentCycle.findFirst({
    where: { quarter, year },
  });
  if (existing) {
    return NextResponse.json({ error: "Cycle already exists for this period" }, { status: 409 });
  }

  const cycle = await prisma.assessmentCycle.create({
    data: {
      quarter,
      year,
      readyToMeetDueAt: milestones.readyToMeet,
      meetingDueAt: milestones.meetingComplete,
      resultsDueAt: milestones.resultsSent,
    },
  });

  // Auto-create self-assessments for all active users
  // and manager assessments for all active users who have a manager
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, managerId: true },
  });

  const selfAssessmentData = activeUsers.map((u) => ({
    cycleId: cycle.id,
    employeeId: u.id,
  }));

  const managerAssessmentData = activeUsers
    .filter((u) => u.managerId)
    .map((u) => ({
      cycleId: cycle.id,
      managerId: u.managerId!,
      employeeId: u.id,
    }));

  await prisma.selfAssessment.createMany({ data: selfAssessmentData });
  if (managerAssessmentData.length > 0) {
    await prisma.managerAssessment.createMany({ data: managerAssessmentData });
  }

  // Tell everyone the cycle is open, after the response is sent.
  after(() => notifyCycleOpened(cycle.id).catch((err) => console.error("cycle_opened email failed", err)));

  return NextResponse.json(cycle, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Cycle id is required" }, { status: 400 });
  }

  await prisma.selfAssessment.deleteMany({ where: { cycleId: id } });
  await prisma.managerAssessment.deleteMany({ where: { cycleId: id } });
  await prisma.assessmentCycle.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, status, readyToMeetDueAt, meetingDueAt, resultsDueAt } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Cycle id is required" }, { status: 400 });
  }
  if (status !== undefined && !["OPEN", "CLOSED"].includes(status)) {
    return NextResponse.json({ error: "Valid status is required" }, { status: 400 });
  }

  const existing = await prisma.assessmentCycle.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;

  // Milestone dates can be adjusted after creation; blank restores the default.
  const dateFields = { readyToMeetDueAt, meetingDueAt, resultsDueAt } as const;
  for (const [field, value] of Object.entries(dateFields)) {
    const parsed = parseDate(value);
    if (parsed !== undefined) data[field] = parsed;
  }
  if (Object.keys(data).some((k) => k.endsWith("DueAt"))) {
    const defaults = getCycleDueDates(existing);
    const merged = { ...existing, ...data } as typeof existing;
    const milestones = {
      readyToMeet: merged.readyToMeetDueAt ?? defaults.readyToMeet,
      meetingComplete: merged.meetingDueAt ?? defaults.meetingComplete,
      resultsSent: merged.resultsDueAt ?? defaults.resultsSent,
    };
    if (!milestonesInOrder(milestones)) {
      return NextResponse.json({ error: "Milestones must be in order: Ready to Meet, then Meeting Complete, then Results Sent" }, { status: 400 });
    }
  }

  const cycle = await prisma.assessmentCycle.update({ where: { id }, data });

  return NextResponse.json(cycle);
}
