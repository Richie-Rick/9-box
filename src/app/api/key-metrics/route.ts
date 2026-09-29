import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager, canAccessEmployee, canManageEmployee } from "@/lib/permissions";

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

  if (!(await canAccessEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const metrics = await prisma.keyMetric.findMany({
    where: { employeeId },
    include: { createdBy: { select: { id: true, name: true } } },
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

  if (!(await canManageEmployee(session.user.id, session.user.role, employeeId))) {
    return NextResponse.json({ error: "Only the employee's manager can set metrics" }, { status: 403 });
  }

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
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isCreator && !isAdmin && !isManager(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const isAdmin = session.user.role === "ADMIN";
  if (!isCreator && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.keyMetric.delete({ where: { id: metricId } });
  return NextResponse.json({ success: true });
}
