import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Saves meeting notes only. Completion is a separate call (./complete). */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assessmentId, notes } = await request.json();
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  const assessment = await prisma.managerAssessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }
  if (assessment.managerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.managerAssessment.update({
    where: { id: assessmentId },
    data: { oneOnOneNotes: typeof notes === "string" && notes.trim() ? notes : null },
    select: { id: true, oneOnOneNotes: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}

/** Kept for older clients: saves notes and marks the 1:1 complete. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assessmentId, notes } = await request.json();
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  const assessment = await prisma.managerAssessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }
  if (assessment.managerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!assessment.submittedAt) {
    return NextResponse.json({ error: "Assessment must be submitted first" }, { status: 400 });
  }

  const updated = await prisma.managerAssessment.update({
    where: { id: assessmentId },
    data: {
      oneOnOneNotes: typeof notes === "string" && notes.trim() ? notes : null,
      oneOnOneComplete: true,
      oneOnOneCompletedAt: assessment.oneOnOneCompletedAt ?? new Date(),
    },
  });

  return NextResponse.json(updated);
}
