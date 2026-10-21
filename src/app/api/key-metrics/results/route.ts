import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageEmployee } from "@/lib/permissions";

// Records (or updates) a key metric's actual result for a given review cycle.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keyMetricId, cycleId, actual, note } = await request.json();
  if (!keyMetricId || !cycleId || actual === undefined || actual === null || `${actual}`.trim() === "") {
    return NextResponse.json(
      { error: "keyMetricId, cycleId and actual are required" },
      { status: 400 }
    );
  }

  const metric = await prisma.keyMetric.findUnique({ where: { id: keyMetricId } });
  if (!metric) {
    return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  }

  // The metric's own employee may record their actual & comment; their
  // manager (or leadership) may record for them.
  const isOwner = metric.employeeId === session.user.id;
  if (!isOwner && !(await canManageEmployee(session.user.id, session.user.role, metric.employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await prisma.metricResult.upsert({
    where: { keyMetricId_cycleId: { keyMetricId, cycleId } },
    create: {
      keyMetricId,
      cycleId,
      actual: `${actual}`.trim(),
      note: note?.trim() || null,
      createdById: session.user.id,
    },
    update: {
      actual: `${actual}`.trim(),
      note: note?.trim() || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(result);
}
