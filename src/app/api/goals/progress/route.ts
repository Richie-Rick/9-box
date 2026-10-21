import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageEmployee } from "@/lib/permissions";

const VALID = ["ON_TRACK", "OFF_TRACK", "COMPLETE"] as const;
type Progress = (typeof VALID)[number];

// Records (or updates) the caller's progress update for a goal in a given
// review cycle. The employee and their manager each keep their own update
// (one per author per cycle) so neither overwrites the other.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId, cycleId, status, note } = await request.json();
  if (!goalId || !cycleId || !VALID.includes(status)) {
    return NextResponse.json(
      { error: "goalId, cycleId and a valid status (ON_TRACK/OFF_TRACK/COMPLETE) are required" },
      { status: 400 }
    );
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

  const update = await prisma.goalUpdate.upsert({
    where: { goalId_cycleId_createdById: { goalId, cycleId, createdById: session.user.id } },
    create: {
      goalId,
      cycleId,
      status: status as Progress,
      note: note?.trim() || null,
      createdById: session.user.id,
    },
    update: {
      status: status as Progress,
      note: note?.trim() || null,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  // The manager's update drives the goal's lifecycle: marking it complete in
  // review completes the goal, anything else keeps (or returns) it active.
  // The employee's own update is their view and leaves the lifecycle alone.
  if (canManage) {
    await prisma.goal.update({
      where: { id: goalId },
      data: { status: status === "COMPLETE" ? "COMPLETED" : "ACTIVE" },
    });
  }

  return NextResponse.json(update);
}
