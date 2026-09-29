import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sanitizeAssessmentInput,
  missingRequired,
  SELF_RATING_FIELDS,
  SELF_TEXT_FIELDS,
  SELF_REQUIRED_FIELDS,
} from "@/lib/assessment-fields";
import { SECTIONS, sectionRatingFields } from "@/lib/assessment-sections";

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

  // Provide last month's stated goals as read-only context for the new form.
  // Nothing is copied into the editable fields.
  const prefill = searchParams.get("prefill") === "true";
  if (prefill && cycleId && assessments.length > 0 && !assessments[0].submittedAt) {
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
      if (prev?.submittedAt && prev.goalsNextMonth) {
        return NextResponse.json([{
          ...assessments[0],
          _previous: {
            month: previousCycle.month,
            year: previousCycle.year,
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

  const body = (await request.json()) as Record<string, unknown>;
  const cycleId = typeof body.cycleId === "string" ? body.cycleId : null;
  const submit = body.submit === true;

  if (!cycleId) {
    return NextResponse.json({ error: "cycleId is required" }, { status: 400 });
  }

  const cycle = await prisma.assessmentCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== "OPEN") {
    return NextResponse.json({ error: "This cycle is closed. Ask your admin to reopen it." }, { status: 400 });
  }

  const { data, errors } = sanitizeAssessmentInput(body, SELF_RATING_FIELDS, SELF_TEXT_FIELDS);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
  }

  const uniqueWhere = { cycleId_employeeId: { cycleId, employeeId: session.user.id } };
  const existing = await prisma.selfAssessment.findUnique({ where: uniqueWhere });

  if (existing?.submittedAt) {
    // Edits are allowed until the manager has read that section
    const before = existing as unknown as Record<string, unknown>;
    const changed = Object.keys(data).filter((key) => (before[key] ?? null) !== data[key]);
    if (changed.length > 0) {
      const managerAssessment = await prisma.managerAssessment.findFirst({
        where: { cycleId, employeeId: session.user.id },
        select: { initialRatings: true },
      });
      const revealed = (managerAssessment?.initialRatings as Record<string, number> | null) ?? {};
      const lockedSections = SECTIONS.filter((section) => {
        const touches = section.questions.some((q) => q.fields.self && changed.includes(q.fields.self));
        if (!touches) return false;
        const fields = sectionRatingFields(section.id, "manager");
        return fields.length > 0 && fields.every((f) => f in revealed);
      });
      if (lockedSections.length > 0) {
        return NextResponse.json(
          { error: `Your manager has already read: ${lockedSections.map((s) => s.title).join(", ")}. Those sections can no longer be changed.` },
          { status: 409 }
        );
      }
    }
  }

  const writeData: Record<string, unknown> = { ...data };
  if (submit && !existing?.submittedAt) {
    const merged = { ...(existing ?? {}), ...data };
    const missing = missingRequired(merged, SELF_REQUIRED_FIELDS);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Ratings still needed: ${missing.join(", ")}`, missing },
        { status: 400 }
      );
    }
    writeData.submittedAt = new Date();
  }

  const assessment = await prisma.selfAssessment.upsert({
    where: uniqueWhere,
    update: writeData,
    create: {
      cycleId,
      employeeId: session.user.id,
      ...writeData,
    },
  });

  let bothComplete = false;
  if (assessment.submittedAt) {
    const managerAssessment = await prisma.managerAssessment.findFirst({
      where: { cycleId, employeeId: session.user.id, submittedAt: { not: null } },
    });
    bothComplete = !!managerAssessment;
  }

  return NextResponse.json({ ...assessment, bothComplete });
}
