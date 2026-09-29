import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { computeStage } from "@/lib/stages";

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
        updatedAt: true,
        performance: true,
        submittedAt: true,
        sharedAt: true,
        oneOnOneCompletedAt: true,
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
        performance: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const selfMap = new Map(selfAssessments.map((s) => [s.employeeId, s]));

  const assessments = managerAssessments.map((ma) => {
    const selfA = selfMap.get(ma.employee.id);
    const selfStarted = !!selfA && (selfA.performance !== null || selfA.updatedAt.getTime() !== selfA.createdAt.getTime());
    const managerStarted = ma.performance !== null || ma.updatedAt.getTime() !== ma.createdAt.getTime();
    const stage = computeStage({
      selfStarted,
      selfSubmitted: !!selfA?.submittedAt,
      managerStarted,
      managerSubmitted: !!ma.submittedAt,
      sharedAt: ma.sharedAt,
      oneOnOneCompletedAt: ma.oneOnOneCompletedAt,
    });

    return {
      id: ma.id,
      employee: ma.employee,
      manager: ma.manager,
      selfStatus: selfA?.submittedAt ? "submitted" : "pending",
      managerStatus: ma.submittedAt ? "submitted" : "pending",
      stage,
      createdAt: ma.createdAt,
      submittedAt: ma.submittedAt,
      sharedAt: ma.sharedAt,
      oneOnOneCompletedAt: ma.oneOnOneCompletedAt,
    };
  });

  const stats = {
    total: assessments.length,
    notStarted: assessments.filter((a) => a.stage === "not_started").length,
    inProgress: assessments.filter((a) => a.stage === "in_progress").length,
    submitted: assessments.filter((a) => a.stage === "submitted").length,
    shared: assessments.filter((a) => a.stage === "shared").length,
    meetingDone: assessments.filter((a) => a.stage === "meeting_done").length,
  };

  return NextResponse.json({ cycle, assessments, stats });
}
