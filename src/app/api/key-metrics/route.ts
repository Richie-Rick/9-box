import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageEmployee } from "@/lib/permissions";
import { dbErrorResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  const isOwn = employeeId === session.user.id;
  if (!isOwn && !(await canManageEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // When a cycleId is supplied, include this cycle's recorded actual result.
  const cycleId = searchParams.get("cycleId");

  const metrics = await prisma.keyMetric.findMany({
    where: { employeeId },
    include: {
      createdBy: { select: { id: true, name: true } },
      results: cycleId
        ? { where: { cycleId }, orderBy: { createdAt: "desc" }, take: 1 }
        : false,
    },
    orderBy: { createdAt: "desc" },
  });

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

  // Employees may set their own key metrics; managers may set them for their reports.
  const isOwn = employeeId === session.user.id;
  if (!isOwn && !(await canManageEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const metric = await prisma.keyMetric.create({
      data: {
        employeeId,
        createdById: session.user.id,
        name,
        target,
        unit: unit || null,
        notes: notes || null,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json(metric);
  } catch (err) {
    return dbErrorResponse(err, "Save metric");
  }
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
  const isCreator = metric.createdById === session.user.id;
  if (!isOwner && !isCreator && !(await canManageEmployee(session.user.id, session.user.role, metric.employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Role-set metrics keep the template's name and target; notes stay editable.
  if (metric.templateId && session.user.role !== "ADMIN" && (name !== undefined || target !== undefined || unit !== undefined)) {
    return NextResponse.json({ error: "This metric is set by the job role. Ask an admin to change it under Roles & Templates." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (target !== undefined) data.target = target;
  if (unit !== undefined) data.unit = unit || null;
  if (notes !== undefined) data.notes = notes || null;

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

  const isCreator = metric.createdById === session.user.id;
  if (!isCreator && !(await canManageEmployee(session.user.id, session.user.role, metric.employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Role-set metrics are managed from Admin → Roles & Templates.
  if (metric.templateId && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "This metric is set by the job role. Ask an admin to change it under Roles & Templates." }, { status: 400 });
  }

  await prisma.keyMetric.delete({ where: { id: metricId } });
  return NextResponse.json({ success: true });
}
