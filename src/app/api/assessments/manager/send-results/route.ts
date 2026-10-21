import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManager(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  if (assessment.managerId !== session.user.id) {
    return NextResponse.json({ error: "Not your assessment" }, { status: 403 });
  }

  if (!assessment.submittedAt) {
    return NextResponse.json({ error: "Manager assessment must be submitted first" }, { status: 400 });
  }

  if (assessment.resultsSentAt) {
    return NextResponse.json({ error: "Results have already been sent" }, { status: 400 });
  }

  // Verify self-assessment is submitted
  const selfAssessment = await prisma.selfAssessment.findUnique({
    where: {
      cycleId_employeeId: {
        cycleId: assessment.cycleId,
        employeeId: assessment.employeeId,
      },
    },
  });

  if (!selfAssessment?.submittedAt) {
    return NextResponse.json({ error: "Employee self-assessment must be submitted first" }, { status: 400 });
  }

  const updated = await prisma.managerAssessment.update({
    where: { id: assessmentId },
    data: { resultsSentAt: new Date() },
  });

  await logAudit({
    actorId: session.user.id,
    action: "assessment.send",
    entityType: "ManagerAssessment",
    entityId: assessmentId,
    summary: "Sent results to employee",
  });

  return NextResponse.json({ resultsSentAt: updated.resultsSentAt });
}
