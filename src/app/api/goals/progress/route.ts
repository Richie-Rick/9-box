import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageEmployee } from "@/lib/permissions";

const VALID = ["ON_TRACK", "OFF_TRACK", "COMPLETE"] as const;
type Progress = (typeof VALID)[number];

// Records (or updates) a goal's progress for a given review cycle. The goal's
// owner or a manager of that employee may post.
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
  if (!isOwner && !(await canManageEmployee(session.user.id, session.user.role, goal.employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update = await prisma.goalUpdate.upsert({
    where: { goalId_cycleId: { goalId, cycleId } },
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
      createdById: session.user.id,
    },
  });

  // Keep the goal's lifecycle status in sync: completing a goal in review marks
  // it complete; otherwise it remains active.
  await prisma.goal.update({
    where: { id: goalId },
    data: { status: status === "COMPLETE" ? "COMPLETED" : "ACTIVE" },
  });

  return NextResponse.json(update);
}
