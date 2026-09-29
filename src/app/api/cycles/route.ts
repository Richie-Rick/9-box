import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { notifyCycleOpened } from "@/lib/notifications";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cycles = await prisma.assessmentCycle.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
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

  const { month, year, selfDueAt, managerDueAt, meetingDueAt, sendEmails } = await request.json();

  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: "Valid month and year are required" }, { status: 400 });
  }

  const parseDate = (value: unknown, fallbackDay: number): Date => {
    if (typeof value === "string" && value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date(year, month - 1, fallbackDay, 17, 0, 0);
  };

  const existing = await prisma.assessmentCycle.findUnique({
    where: { month_year: { month, year } },
  });
  if (existing) {
    return NextResponse.json({ error: "Cycle already exists for this period" }, { status: 409 });
  }

  const cycle = await prisma.assessmentCycle.create({
    data: {
      month,
      year,
      selfDueAt: parseDate(selfDueAt, 7),
      managerDueAt: parseDate(managerDueAt, 14),
      meetingDueAt: parseDate(meetingDueAt, 21),
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

  if (sendEmails !== false) {
    after(() => notifyCycleOpened(cycle.id).catch((err) => console.error("cycle_opened emails failed", err)));
  }

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

  const { id, status, selfDueAt, managerDueAt, meetingDueAt } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (status !== undefined) {
    if (!["OPEN", "CLOSED"].includes(status)) {
      return NextResponse.json({ error: "Valid status is required" }, { status: 400 });
    }
    data.status = status;
  }
  const toDate = (value: unknown) => (typeof value === "string" && value ? new Date(value) : null);
  if (selfDueAt !== undefined) data.selfDueAt = toDate(selfDueAt);
  if (managerDueAt !== undefined) data.managerDueAt = toDate(managerDueAt);
  if (meetingDueAt !== undefined) data.meetingDueAt = toDate(meetingDueAt);

  const cycle = await prisma.assessmentCycle.update({
    where: { id },
    data,
  });

  return NextResponse.json(cycle);
}
