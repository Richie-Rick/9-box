import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessEmployee, canManageEmployee } from "@/lib/permissions";

const STATUSES = ["ON_TRACK", "OFF_TRACK", "DONE"] as const;
type UpdateStatus = (typeof STATUSES)[number];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const cycleId = searchParams.get("cycleId");
  if (!employeeId || !cycleId) {
    return NextResponse.json({ error: "employeeId and cycleId are required" }, { status: 400 });
  }

  if (!(await canAccessEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates = await prisma.goalUpdate.findMany({
    where: { cycleId, goal: { employeeId } },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updates);
}

/** Upserts the caller's status update for one goal in one cycle. */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId, cycleId, status, note } = await request.json();
  if (!goalId || !cycleId || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "goalId, cycleId and a valid status are required" }, { status: 400 });
  }

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const isOwner = goal.employeeId === session.user.id;
  const canManage = await canManageEmployee(session.user.id, session.user.role, goal.employeeId);
  if (!isOwner && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cycle = await prisma.assessmentCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== "OPEN") {
    return NextResponse.json({ error: "This cycle is closed" }, { status: 400 });
  }

  const update = await prisma.goalUpdate.upsert({
    where: { goalId_cycleId_authorId: { goalId, cycleId, authorId: session.user.id } },
    update: { status: status as UpdateStatus, note: typeof note === "string" && note.trim() ? note.trim() : null },
    create: {
      goalId,
      cycleId,
      authorId: session.user.id,
      status: status as UpdateStatus,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  // A manager marking a goal done completes it
  if (status === "DONE" && canManage && goal.status === "ACTIVE") {
    await prisma.goal.update({ where: { id: goalId }, data: { status: "COMPLETED" } });
  }

  return NextResponse.json(update);
}
