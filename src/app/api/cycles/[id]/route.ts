import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const cycle = await prisma.assessmentCycle.findUnique({
    where: { id },
  });
  if (!cycle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [managerAssessments, selfAssessments] = await Promise.all([
    prisma.managerAssessment.findMany({
      where: { cycleId: id },
      select: {
        id: true,
        createdAt: true,
        submittedAt: true,
        resultsSentAt: true,
        unlockedAt: true,
        employee: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true } },
      },
      orderBy: { employee: { name: "asc" } },
    }),
    prisma.selfAssessment.findMany({
      where: { cycleId: id },
      select: {
        id: true,
        employeeId: true,
        submittedAt: true,
        unlockedAt: true,
      },
    }),
  ]);

  const selfMap = new Map(selfAssessments.map((s) => [s.employeeId, s]));

  const assessments = managerAssessments.map((ma) => {
    const selfA = selfMap.get(ma.employee.id);
    const selfStatus = selfA?.submittedAt ? "submitted" : "pending";
    const mgrStatus = ma.submittedAt ? "submitted" : "pending";

    let overallStatus: string;
    if (ma.resultsSentAt) {
      overallStatus = "results_sent";
    } else if (mgrStatus === "submitted" && selfStatus === "submitted") {
      overallStatus = "ready_to_send";
    } else if (mgrStatus === "submitted" || selfStatus === "submitted") {
      overallStatus = "in_progress";
    } else {
      overallStatus = "pending";
    }

    return {
      id: ma.id,
      employee: ma.employee,
      manager: ma.manager,
      selfStatus,
      managerStatus: mgrStatus,
      overallStatus,
      createdAt: ma.createdAt,
      submittedAt: ma.submittedAt,
      resultsSentAt: ma.resultsSentAt,
      managerUnlockedAt: ma.unlockedAt,
      selfAssessmentId: selfA?.id ?? null,
      selfUnlockedAt: selfA?.unlockedAt ?? null,
    };
  });

  const stats = {
    total: assessments.length,
    pending: assessments.filter((a) => a.overallStatus === "pending").length,
    inProgress: assessments.filter((a) => a.overallStatus === "in_progress").length,
    readyToSend: assessments.filter((a) => a.overallStatus === "ready_to_send").length,
    resultsSent: assessments.filter((a) => a.overallStatus === "results_sent").length,
  };

  return NextResponse.json({ cycle, assessments, stats });
}
