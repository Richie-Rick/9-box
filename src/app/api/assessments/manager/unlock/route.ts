import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assessmentId } = await request.json();
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  const assessment = await prisma.managerAssessment.findUnique({
    where: { id: assessmentId },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const isOwner = assessment.managerId === session.user.id;
  const isElevated = session.user.role === "LEADERSHIP" || session.user.role === "ADMIN";
  if (!isOwner && !isElevated) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Clear the hard lock so the assessment can be edited and later re-sent.
  // submittedAt is intentionally left unchanged.
  const updated = await prisma.managerAssessment.update({
    where: { id: assessmentId },
    data: { resultsSentAt: null },
  });

  await logAudit({
    actorId: session.user.id,
    action: "assessment.unlock",
    entityType: "ManagerAssessment",
    entityId: assessmentId,
    summary: "Unlocked completed assessment for editing",
  });

  return NextResponse.json(updated);
}
