import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SELF_FIELDS, pickFields, canEditSubmitted } from "@/lib/assessment-rules";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycleId");

  const where: Record<string, unknown> = {
    employeeId: session.user.id,
  };
  if (cycleId) where.cycleId = cycleId;

  const assessments = await prisma.selfAssessment.findMany({
    where,
    include: { cycle: true },
    orderBy: { createdAt: "desc" },
  });

  const prefill = searchParams.get("prefill") === "true";
  if (prefill && cycleId && assessments.length > 0 && !assessments[0].submittedAt && !assessments[0].performance) {
    const currentCycle = assessments[0].cycle;
    const previousCycle = await prisma.assessmentCycle.findFirst({
      where: {
        id: { not: cycleId },
        OR: [
          { year: { lt: currentCycle.year } },
          { year: currentCycle.year, month: { lt: currentCycle.month } },
        ],
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    if (previousCycle) {
      const prev = await prisma.selfAssessment.findUnique({
        where: { cycleId_employeeId: { cycleId: previousCycle.id, employeeId: session.user.id } },
      });
      if (prev?.submittedAt) {
        return NextResponse.json([{
          ...assessments[0],
          _prefilled: {
            performanceJustification: prev.performanceJustification,
            achievements: prev.achievements,
            blockers: prev.blockers,
            learning: prev.learning,
            valuesReflection: prev.valuesReflection,
            engagementDriver: prev.engagementDriver,
            supportNeeded: prev.supportNeeded,
            goalsNextMonth: prev.goalsNextMonth,
          },
        }]);
      }
    }
  }

  if (cycleId && assessments.length > 0) {
    const a = assessments[0];
    const resultsSent = !!(await prisma.managerAssessment.findFirst({
      where: { cycleId, employeeId: session.user.id, resultsSentAt: { not: null } },
    }));
    const canEdit = a.cycle.status === "OPEN" && canEditSubmitted(resultsSent, a.unlockedAt);
    return NextResponse.json([{ ...a, _canEdit: canEdit }, ...assessments.slice(1)]);
  }

  return NextResponse.json(assessments);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { cycleId, submit } = body;

  if (!cycleId) {
    return NextResponse.json({ error: "cycleId is required" }, { status: 400 });
  }

  // Verify cycle is open
  const cycle = await prisma.assessmentCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== "OPEN") {
    return NextResponse.json({ error: "Cycle is not open" }, { status: 400 });
  }

  // Lifecycle fields are server-managed; only whitelisted content fields are written
  const data = pickFields(body, SELF_FIELDS);

  const existing = await prisma.selfAssessment.findUnique({
    where: { cycleId_employeeId: { cycleId, employeeId: session.user.id } },
  });

  if (existing?.submittedAt) {
    const resultsSent = !!(await prisma.managerAssessment.findFirst({
      where: { cycleId, employeeId: session.user.id, resultsSentAt: { not: null } },
    }));
    if (!canEditSubmitted(resultsSent, existing.unlockedAt)) {
      return NextResponse.json(
        { error: "This assessment is locked because results have been sent. Ask an admin to unlock it." },
        { status: 403 }
      );
    }
    data.lastEditedAt = new Date();
  } else if (submit === true) {
    data.submittedAt = new Date();
  }

  const assessment = await prisma.selfAssessment.upsert({
    where: {
      cycleId_employeeId: {
        cycleId,
        employeeId: session.user.id,
      },
    },
    update: { ...data, updatedAt: new Date() },
    create: {
      cycleId,
      employeeId: session.user.id,
      ...data,
    },
  });

  // Check if both assessments are now complete
  let bothComplete = false;
  if (assessment.submittedAt) {
    const managerAssessment = await prisma.managerAssessment.findFirst({
      where: { cycleId, employeeId: session.user.id, submittedAt: { not: null } },
    });
    bothComplete = !!managerAssessment;
  }

  return NextResponse.json({ ...assessment, bothComplete });
}
