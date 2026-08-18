import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager, canManageEmployee } from "@/lib/permissions";
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

  // The row's own manager can send, and so can anyone who currently owns the
  // employee — their present manager, or leadership/admin. Restricting this to
  // the original author meant a review could become permanently invisible to
  // the employee once that manager left or the report was reassigned. The audit
  // entry records who actually sent it.
  const isOwner = assessment.managerId === session.user.id;
  const canManage = await canManageEmployee(
    session.user.id,
    session.user.role,
    assessment.employeeId
  );
  if (!isOwner && !canManage) {
    return NextResponse.json({ error: "Not your assessment" }, { status: 403 });
  }

  if (!assessment.submittedAt) {
    return NextResponse.json({ error: "Manager assessment must be submitted first" }, { status: 400 });
  }

  // Already sent and not re-opened for editing — nothing to do. When it has been
  // unlocked this is a re-send that republishes the edits.
  const isResend = !!assessment.resultsSentAt && !!assessment.unlockedAt;
  if (assessment.resultsSentAt && !isResend) {
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
    data: { resultsSentAt: new Date(), unlockedAt: null },
  });

  await logAudit({
    actorId: session.user.id,
    action: "assessment.send",
    entityType: "ManagerAssessment",
    entityId: assessmentId,
    summary: isResend ? "Re-sent results after editing" : "Sent results to employee",
  });

  return NextResponse.json({ resultsSentAt: updated.resultsSentAt });
}
