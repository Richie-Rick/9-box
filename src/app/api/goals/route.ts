import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessEmployee, canManageEmployee } from "@/lib/permissions";

const GOAL_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  proposedBy: { select: { id: true, name: true } },
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const cycleId = searchParams.get("cycleId");

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  if (!(await canAccessEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const goals = await prisma.goal.findMany({
    where: { employeeId },
    include: {
      ...GOAL_INCLUDE,
      updates: cycleId
        ? { where: { cycleId }, include: { author: { select: { id: true, name: true } } } }
        : false,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(goals);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { employeeId, title, description, dueDate } = await request.json();

  if (!employeeId || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "employeeId and title are required" }, { status: 400 });
  }

  const isSelf = employeeId === session.user.id;
  if (!isSelf && !(await canManageEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Only the employee's manager can set goals" }, { status: 403 });
  }

  const goal = await prisma.goal.create({
    data: {
      employeeId,
      createdById: session.user.id,
      proposedById: isSelf ? session.user.id : null,
      status: isSelf ? "PROPOSED" : "ACTIVE",
      title: title.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: GOAL_INCLUDE,
  });

  return NextResponse.json(goal);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId, title, description, dueDate, status } = await request.json();
  if (!goalId) {
    return NextResponse.json({ error: "goalId is required" }, { status: 400 });
  }

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const isOwner = goal.employeeId === session.user.id;
  const canManage = await canManageEmployee(session.user.id, session.user.role, goal.employeeId);

  // Employees may only edit or withdraw their own proposals
  if (!canManage) {
    const withdrawing = status === "CANCELLED" || status === undefined;
    if (!(isOwner && goal.status === "PROPOSED" && withdrawing)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = String(title).trim();
  if (description !== undefined) data.description = description ? String(description).trim() : null;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (status !== undefined) {
    if (!["PROPOSED", "ACTIVE", "COMPLETED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = status;
  }

  const updated = await prisma.goal.update({
    where: { id: goalId },
    data,
    include: GOAL_INCLUDE,
  });

  return NextResponse.json(updated);
}
