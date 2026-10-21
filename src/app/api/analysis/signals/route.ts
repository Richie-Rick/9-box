import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager, getVisibleEmployeeIds } from "@/lib/permissions";
import { sectionRatingFields, SECTIONS } from "@/lib/assessment-sections";

const MANAGER_RATING_FIELDS = SECTIONS.flatMap((s) => sectionRatingFields(s.id, "manager"));

/**
 * The accountability signals Analysis rolls up per manager for one cycle,
 * scoped to the employees the caller can see:
 * - managers: each manager's active report count (so a manager who has not
 *   started any assessment still shows as 0 of n);
 * - edits: assessments edited after submission, from the audit log;
 * - adjusted: assessments whose ratings moved after the self-assessment was
 *   revealed (initialRatings differs from the current ratings);
 * - results: key-metric results with their hit/missed flag.
 */
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
  if (!cycleId) {
    return NextResponse.json({ error: "cycleId is required" }, { status: 400 });
  }

  const visible = await getVisibleEmployeeIds(session.user.id, session.user.role);
  const employeeWhere = visible === "all" ? {} : { id: { in: visible } };

  const [reports, assessments, results] = await Promise.all([
    prisma.user.findMany({
      where: { ...employeeWhere, isActive: true, managerId: { not: null } },
      select: { id: true, managerId: true, manager: { select: { id: true, name: true } } },
    }),
    prisma.managerAssessment.findMany({
      where: { cycleId, ...(visible === "all" ? {} : { employeeId: { in: visible } }) },
      select: {
        id: true,
        employeeId: true,
        managerId: true,
        initialRatings: true,
        performance: true,
        growthReadiness: true,
        valCustomerFirst: true,
        valStepIntoArena: true,
        valFlockToProblems: true,
        valGiveEnergy: true,
        engagement: true,
      },
    }),
    prisma.metricResult.findMany({
      where: {
        cycleId,
        ...(visible === "all" ? {} : { keyMetric: { employeeId: { in: visible } } }),
      },
      select: {
        keyMetricId: true,
        achieved: true,
        actual: true,
        keyMetric: { select: { name: true, employeeId: true } },
      },
    }),
  ]);

  const edits = assessments.length
    ? await prisma.auditLog.groupBy({
        by: ["entityId"],
        where: {
          entityType: "ManagerAssessment",
          action: "assessment.edit",
          entityId: { in: assessments.map((a) => a.id) },
        },
        _count: { _all: true },
      })
    : [];

  const managers = new Map<string, { id: string; name: string; reports: number }>();
  for (const r of reports) {
    if (!r.manager) continue;
    const entry = managers.get(r.manager.id) ?? { id: r.manager.id, name: r.manager.name, reports: 0 };
    entry.reports += 1;
    managers.set(r.manager.id, entry);
  }

  const adjusted = assessments
    .filter((a) => {
      const initial = (a.initialRatings as Record<string, number> | null) ?? null;
      if (!initial) return false;
      const record = a as unknown as Record<string, unknown>;
      return MANAGER_RATING_FIELDS.some((f) => f in initial && initial[f] !== record[f]);
    })
    .map((a) => a.id);

  return NextResponse.json({
    managers: [...managers.values()],
    edits: Object.fromEntries(edits.map((e) => [e.entityId, e._count._all])),
    adjusted,
    results: results.map((r) => ({
      employeeId: r.keyMetric.employeeId,
      keyMetricId: r.keyMetricId,
      name: r.keyMetric.name,
      actual: r.actual,
      achieved: r.achieved,
    })),
  });
}
