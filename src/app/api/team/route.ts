import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/permissions";

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
      startDate: true,
      selfAssessments: cycleId
        ? { where: { cycleId }, select: { id: true, submittedAt: true } }
        : undefined,
      managerAssessmentsReceived: cycleId
        ? {
            where: { cycleId, managerId: session.user.id },
            select: { id: true, submittedAt: true, resultsSentAt: true, unlockedAt: true, meetingStatus: true, meeting: { select: { id: true } } },
          }
        : undefined,
    },
    orderBy: { name: "asc" },
  });

  const teamStatus = reports.map((r) => {
    const selfAssessment = r.selfAssessments?.[0];
    const managerAssessment = r.managerAssessmentsReceived?.[0] as
      | { id: string; submittedAt: Date | null; resultsSentAt: Date | null; unlockedAt: Date | null; meetingStatus: string; meeting?: { id: string } | null }
      | undefined;

    return {
      id: r.id,
      name: r.name,
      email: r.email,
      jobTitle: r.jobTitle,
      team: r.team,
      startDate: r.startDate,
      selfAssessmentStatus: !selfAssessment
        ? "not_started"
        : selfAssessment.submittedAt
          ? "submitted"
          : "draft",
      managerAssessmentStatus: !managerAssessment
        ? "not_started"
        : managerAssessment.submittedAt
          ? "submitted"
          : "draft",
      meetingStatus: managerAssessment?.meetingStatus ?? "NOT_READY",
      meetingStarted: !!managerAssessment?.meeting,
      managerAssessmentId: managerAssessment?.id ?? null,
      resultsSentAt: managerAssessment?.resultsSentAt ?? null,
      unlockedAt: managerAssessment?.unlockedAt ?? null,
    };
  });

  return NextResponse.json(teamStatus);
}
