import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessEmployee, canManageEmployee, getVisibleEmployeeIds } from "@/lib/permissions";

const RESULT_INCLUDE = {
  recordedBy: { select: { id: true, name: true } },
  keyMetric: { select: { id: true, name: true, target: true, unit: true } },
  metricTemplate: { select: { id: true, name: true, target: true, unit: true } },
};

/**
 * Results for one employee (employeeId) or for everyone the viewer can see
 * (no employeeId), optionally restricted to a cycle.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const cycleId = searchParams.get("cycleId");

  const where: Record<string, unknown> = {};
  if (cycleId) where.cycleId = cycleId;

  if (employeeId) {
    if (!(await canAccessEmployee(session.user.id, session.user.role, employeeId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    where.employeeId = employeeId;
  } else {
    const visible = await getVisibleEmployeeIds(session.user.id, session.user.role);
    if (visible !== "all") where.employeeId = { in: visible };
  }

  const results = await prisma.keyMetricResult.findMany({
    where,
    include: RESULT_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(results);
}

/** Upserts one result for a metric (personal or role-set) in a cycle. */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { employeeId, cycleId, keyMetricId, metricTemplateId, actual, achieved, note } = await request.json();

  if (!employeeId || !cycleId || (!keyMetricId && !metricTemplateId)) {
    return NextResponse.json({ error: "employeeId, cycleId and a metric are required" }, { status: 400 });
  }
  if (typeof actual !== "string" || !actual.trim()) {
    return NextResponse.json({ error: "actual is required" }, { status: 400 });
  }

  const isSelf = employeeId === session.user.id;
  if (!isSelf && !(await canManageEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cycle = await prisma.assessmentCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== "OPEN") {
    return NextResponse.json({ error: "This cycle is closed" }, { status: 400 });
  }

  // The metric must belong to (or apply to) this employee
  if (keyMetricId) {
    const metric = await prisma.keyMetric.findUnique({ where: { id: keyMetricId }, select: { employeeId: true } });
    if (!metric || metric.employeeId !== employeeId) {
      return NextResponse.json({ error: "Metric not found for this employee" }, { status: 404 });
    }
  } else {
    const [template, user] = await Promise.all([
      prisma.metricTemplate.findUnique({ where: { id: metricTemplateId }, select: { jobRoleId: true, isActive: true } }),
      prisma.user.findUnique({ where: { id: employeeId }, select: { jobRoleId: true } }),
    ]);
    if (!template || !template.isActive || !user || user.jobRoleId !== template.jobRoleId) {
      return NextResponse.json({ error: "Role metric does not apply to this employee" }, { status: 404 });
    }
  }

  const data = {
    actual: actual.trim(),
    achieved: typeof achieved === "boolean" ? achieved : null,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
    recordedById: session.user.id,
  };

  const existing = await prisma.keyMetricResult.findFirst({
    where: keyMetricId
      ? { employeeId, cycleId, keyMetricId }
      : { employeeId, cycleId, metricTemplateId },
  });

  const result = existing
    ? await prisma.keyMetricResult.update({ where: { id: existing.id }, data, include: RESULT_INCLUDE })
    : await prisma.keyMetricResult.create({
        data: {
          employeeId,
          cycleId,
          keyMetricId: keyMetricId ?? null,
          metricTemplateId: metricTemplateId ?? null,
          ...data,
        },
        include: RESULT_INCLUDE,
      });

  return NextResponse.json(result);
}
