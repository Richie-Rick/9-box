import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { comparePeriodDesc } from "@/lib/utils";
import { logAudit, diffFields } from "@/lib/audit";
import { SELF_ASSESSMENT_FIELDS, pickFields } from "@/lib/assessment-fields";

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
    // Find the most recent cycle strictly before the current one. Cycles may be
    // quarterly or legacy-monthly, so order in JS via the shared comparator.
    const earlierCycles = await prisma.assessmentCycle.findMany({
      where: { id: { not: cycleId } },
    });
    const previousCycle = earlierCycles
      .filter((c) => comparePeriodDesc(currentCycle, c) < 0)
      .sort(comparePeriodDesc)[0];

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

  return NextResponse.json(assessments);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { cycleId, ...data } = body;

  if (!cycleId) {
    return NextResponse.json({ error: "cycleId is required" }, { status: 400 });
  }

  const existing = await prisma.selfAssessment.findUnique({
    where: {
      cycleId_employeeId: { cycleId, employeeId: session.user.id },
    },
  });

  // The cycle must be OPEN to CREATE a brand-new self-assessment. An existing
  // self-assessment can be edited at any point — even after the cycle is closed.
  if (!existing) {
    const cycle = await prisma.assessmentCycle.findUnique({ where: { id: cycleId } });
    if (!cycle || cycle.status !== "OPEN") {
      return NextResponse.json({ error: "Cycle is not open" }, { status: 400 });
    }
  }

  // Only whitelisted content fields are written. submittedAt is stamped
  // server-side: set once when the client submits, never cleared or
  // overwritten with a client-supplied timestamp.
  const content = pickFields(data, SELF_ASSESSMENT_FIELDS);
  const wantsSubmit = Boolean(data.submittedAt);

  const assessment = existing
    ? await prisma.selfAssessment.update({
        where: { id: existing.id },
        data: {
          ...content,
          ...(wantsSubmit && !existing.submittedAt ? { submittedAt: new Date() } : {}),
          updatedAt: new Date(),
        },
      })
    : await prisma.selfAssessment.create({
        data: {
          cycleId,
          employeeId: session.user.id,
          ...content,
          ...(wantsSubmit ? { submittedAt: new Date() } : {}),
        },
      });

  // Editing an already-completed (submitted) self-assessment is allowed but
  // recorded in the audit trail.
  if (existing?.submittedAt) {
    const changes = diffFields(
      existing as unknown as Record<string, unknown>,
      assessment as unknown as Record<string, unknown>,
      SELF_ASSESSMENT_FIELDS
    );
    const changed = Object.keys(changes);
    if (changed.length > 0) {
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const f of changed) {
        before[f] = changes[f].from;
        after[f] = changes[f].to;
      }
      await logAudit({
        actorId: session.user.id,
        action: "assessment.edit",
        entityType: "SelfAssessment",
        entityId: assessment.id,
        summary: `Edited after completion: ${changed.join(", ")}`,
        before,
        after,
      });
    }
  }

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
