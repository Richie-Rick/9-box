import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessEmployee, canManageEmployee } from "@/lib/permissions";
import { effectiveMetrics } from "@/lib/job-roles";

/** Personal metrics plus role-set templates, with results for the cycle. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const cycleId = searchParams.get("cycleId");

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  if (!(await canAccessEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const metrics = await effectiveMetrics(employeeId, cycleId);
  return NextResponse.json(metrics);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { employeeId, name, target, unit, notes } = await request.json();

  if (!employeeId || !name || !target) {
    return NextResponse.json({ error: "employeeId, name, and target are required" }, { status: 400 });
  }

  if (!(await canManageEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Only the employee's manager can set metrics" }, { status: 403 });
  }

  const metric = await prisma.keyMetric.create({
    data: {
      employeeId,
      createdById: session.user.id,
      name: String(name).trim(),
      target: String(target).trim(),
      unit: unit ? String(unit).trim() : null,
      notes: notes ? String(notes).trim() : null,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ ...metric, source: "personal", keyMetricId: metric.id, metricTemplateId: null, result: null, latestResult: null });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { metricId, name, target, unit, notes } = await request.json();
  if (!metricId) {
    return NextResponse.json({ error: "metricId is required" }, { status: 400 });
  }

  const metric = await prisma.keyMetric.findUnique({ where: { id: metricId } });
  if (!metric) {
    return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  }

  const isOwner = metric.employeeId === session.user.id;
  const canManage = await canManageEmployee(session.user.id, session.user.role, metric.employeeId);
  if (!isOwner && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  // The employee may only add notes; the manager may change the definition
  if (canManage) {
    if (name !== undefined) data.name = String(name).trim();
    if (target !== undefined) data.target = String(target).trim();
    if (unit !== undefined) data.unit = unit ? String(unit).trim() : null;
  }
  if (notes !== undefined) data.notes = notes ? String(notes).trim() : null;

  const updated = await prisma.keyMetric.update({
    where: { id: metricId },
    data,
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const metricId = searchParams.get("metricId");
  if (!metricId) {
    return NextResponse.json({ error: "metricId is required" }, { status: 400 });
  }

  const metric = await prisma.keyMetric.findUnique({ where: { id: metricId } });
  if (!metric) {
    return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  }

  if (!(await canManageEmployee(session.user.id, session.user.role, metric.employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.keyMetric.delete({ where: { id: metricId } });
  return NextResponse.json({ success: true });
}
