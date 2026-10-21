import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageEmployee } from "@/lib/permissions";
import { dbErrorResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  const isOwn = employeeId === session.user.id;
  if (!isOwn && !(await canManageEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // When a cycleId is supplied, include this cycle's progress update on each goal.
  const cycleId = searchParams.get("cycleId");

  const goals = await prisma.goal.findMany({
    where: { employeeId },
    include: {
      createdBy: { select: { id: true, name: true } },
      updates: cycleId
        ? { where: { cycleId }, orderBy: { createdAt: "desc" }, take: 1 }
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

  if (!employeeId || !title) {
    return NextResponse.json({ error: "employeeId and title are required" }, { status: 400 });
  }

  // Employees may set their own goals; managers may set goals for their reports.
  const isOwnGoal = employeeId === session.user.id;
  if (!isOwnGoal && !(await canManageEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const goal = await prisma.goal.create({
      data: {
        employeeId,
        createdById: session.user.id,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json(goal);
  } catch (err) {
    return dbErrorResponse(err, "Save goal");
  }
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

  const isCreator = goal.createdById === session.user.id;
  const isOwner = goal.employeeId === session.user.id;
  if (!isCreator && !isOwner && !(await canManageEmployee(session.user.id, session.user.role, goal.employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description || null;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (status !== undefined) data.status = status;

  const updated = await prisma.goal.update({
    where: { id: goalId },
    data,
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}
