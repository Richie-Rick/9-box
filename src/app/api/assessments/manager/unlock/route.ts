import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { canManageEmployee } from "@/lib/permissions";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assessmentId, withdraw } = await request.json();
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  const assessment = await prisma.managerAssessment.findUnique({
    where: { id: assessmentId },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // The row's own manager, the employee's current manager, or leadership/admin.
  const isOwner = assessment.managerId === session.user.id;
  const canManage = await canManageEmployee(
    session.user.id,
    session.user.role,
    assessment.employeeId
  );
  if (!isOwner && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Withdrawing is the deliberate "take it back" action: it clears resultsSentAt
  // and the employee loses access. Unlocking is only about editability — it
  // leaves resultsSentAt alone so a review the employee has already been shown
  // never disappears just because someone opened it to make a correction.
  const updated = await prisma.managerAssessment.update({
    where: { id: assessmentId },
    data: withdraw
      ? { resultsSentAt: null, unlockedAt: null }
      : { unlockedAt: new Date() },
  });

  await logAudit({
    actorId: session.user.id,
    action: withdraw ? "assessment.withdraw" : "assessment.unlock",
    entityType: "ManagerAssessment",
    entityId: assessmentId,
    summary: withdraw
      ? "Withdrew results — no longer visible to the employee"
      : "Unlocked completed assessment for editing (results stay visible)",
  });

  return NextResponse.json(updated);
}
