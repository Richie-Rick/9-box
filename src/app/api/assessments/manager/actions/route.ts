import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllAssessments } from "@/lib/permissions";

async function loadAssessment(assessmentId: string) {
  return prisma.managerAssessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, managerId: true, employeeId: true, oneOnOneCompletedAt: true, sharedAt: true },
  });
}

function canRead(session: { user: { id: string; role: string } }, a: { managerId: string; employeeId: string; oneOnOneCompletedAt: Date | null }) {
  if (a.managerId === session.user.id) return true;
  if (canViewAllAssessments(session.user.role as never)) return true;
  // The employee sees agreed actions once the meeting has been held
  return a.employeeId === session.user.id && !!a.oneOnOneCompletedAt;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const assessmentId = searchParams.get("assessmentId");
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  const assessment = await loadAssessment(assessmentId);
  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canRead(session, assessment)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const actions = await prisma.agreedAction.findMany({
    where: { managerAssessmentId: assessmentId },
    include: { goal: { select: { id: true, title: true, status: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(actions);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assessmentId, text } = await request.json();
  if (!assessmentId || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "assessmentId and text are required" }, { status: 400 });
  }

  const assessment = await loadAssessment(assessmentId);
  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (assessment.managerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const count = await prisma.agreedAction.count({ where: { managerAssessmentId: assessmentId } });
  const action = await prisma.agreedAction.create({
    data: { managerAssessmentId: assessmentId, text: text.trim(), sortOrder: count },
    include: { goal: { select: { id: true, title: true, status: true } } },
  });

  return NextResponse.json(action);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { actionId, text, done, promote, dueDate } = await request.json();
  if (!actionId) {
    return NextResponse.json({ error: "actionId is required" }, { status: 400 });
  }

  const action = await prisma.agreedAction.findUnique({
    where: { id: actionId },
    include: { managerAssessment: { select: { managerId: true, employeeId: true } } },
  });
  if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isManagerOwner = action.managerAssessment.managerId === session.user.id;
  const isEmployee = action.managerAssessment.employeeId === session.user.id;
  // The employee may tick actions off; only the manager edits or promotes
  if (!isManagerOwner && !(isEmployee && done !== undefined && text === undefined && !promote)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (typeof text === "string" && text.trim()) data.text = text.trim();
  if (typeof done === "boolean") data.done = done;

  if (promote && !action.goalId) {
    const goal = await prisma.goal.create({
      data: {
        employeeId: action.managerAssessment.employeeId,
        createdById: session.user.id,
        title: action.text,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: "ACTIVE",
      },
    });
    data.goalId = goal.id;
  }

  const updated = await prisma.agreedAction.update({
    where: { id: actionId },
    data,
    include: { goal: { select: { id: true, title: true, status: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const actionId = searchParams.get("actionId");
  if (!actionId) {
    return NextResponse.json({ error: "actionId is required" }, { status: 400 });
  }

  const action = await prisma.agreedAction.findUnique({
    where: { id: actionId },
    include: { managerAssessment: { select: { managerId: true } } },
  });
  if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (action.managerAssessment.managerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.agreedAction.delete({ where: { id: actionId } });
  return NextResponse.json({ success: true });
}
