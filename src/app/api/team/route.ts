import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/permissions";
import { computeStage } from "@/lib/stages";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManager(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycleId");

  const reports = await prisma.user.findMany({
    where: { managerId: session.user.id, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      team: true,
      selfAssessments: cycleId
        ? { where: { cycleId }, select: { id: true, submittedAt: true, performance: true, updatedAt: true, createdAt: true } }
        : undefined,
      managerAssessmentsReceived: cycleId
        ? {
            where: { cycleId, managerId: session.user.id },
            select: {
              id: true,
              submittedAt: true,
              sharedAt: true,
              oneOnOneCompletedAt: true,
              performance: true,
              updatedAt: true,
              createdAt: true,
            },
          }
        : undefined,
    },
    orderBy: { name: "asc" },
  });

  const teamStatus = reports.map((r) => {
    const selfAssessment = r.selfAssessments?.[0];
    const managerAssessment = r.managerAssessmentsReceived?.[0];

    // Auto-created rows count as "not started" until something is saved
    const selfStarted = !!selfAssessment && (selfAssessment.performance !== null || selfAssessment.updatedAt.getTime() !== selfAssessment.createdAt.getTime());
    const managerStarted = !!managerAssessment && (managerAssessment.performance !== null || managerAssessment.updatedAt.getTime() !== managerAssessment.createdAt.getTime());

    const stage = computeStage({
      selfStarted,
      selfSubmitted: !!selfAssessment?.submittedAt,
      managerStarted,
      managerSubmitted: !!managerAssessment?.submittedAt,
      sharedAt: managerAssessment?.sharedAt,
      oneOnOneCompletedAt: managerAssessment?.oneOnOneCompletedAt,
    });

    return {
      id: r.id,
      name: r.name,
      email: r.email,
      jobTitle: r.jobTitle,
      team: r.team,
      managerAssessmentId: managerAssessment?.id ?? null,
      selfAssessmentStatus: !selfAssessment || !selfStarted
        ? "not_started"
        : selfAssessment.submittedAt
          ? "submitted"
          : "draft",
      managerAssessmentStatus: !managerAssessment || !managerStarted
        ? "not_started"
        : managerAssessment.submittedAt
          ? "submitted"
          : "draft",
      sharedAt: managerAssessment?.sharedAt ?? null,
      oneOnOneCompletedAt: managerAssessment?.oneOnOneCompletedAt ?? null,
      stage,
    };
  });

  return NextResponse.json(teamStatus);
}
