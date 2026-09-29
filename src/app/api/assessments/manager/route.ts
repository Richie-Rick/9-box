import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isManager } from "@/lib/permissions";
import {
  sanitizeAssessmentInput,
  missingRequired,
  MANAGER_RATING_FIELDS,
  MANAGER_TEXT_FIELDS,
  MANAGER_REQUIRED_FIELDS,
  MANAGER_RESPONSE_FIELDS,
} from "@/lib/assessment-fields";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycleId");
  const employeeId = searchParams.get("employeeId");

  const where: Record<string, unknown> = {};
  if (cycleId) where.cycleId = cycleId;
  if (employeeId) where.employeeId = employeeId;

  const role = session.user.role;
  if (role === "MANAGER" || role === "AREA_LEAD") {
    // Managers see the assessments they wrote
    where.managerId = session.user.id;
  } else if (role === "EMPLOYEE") {
    // Employees only ever see their own assessments, and only once shared
    where.employeeId = session.user.id;
    where.sharedAt = { not: null };
  }
  // LEADERSHIP and ADMIN see everything

  const assessments = await prisma.managerAssessment.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true, role: true, team: true, jobTitle: true } },
      manager: { select: { id: true, name: true } },
      cycle: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (role === "EMPLOYEE") {
    return NextResponse.json(assessments.map((a) => ({ ...a, oneOnOneNotes: null })));
  }

  return NextResponse.json(assessments);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManager(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const cycleId = typeof body.cycleId === "string" ? body.cycleId : null;
  const employeeId = typeof body.employeeId === "string" ? body.employeeId : null;
  const submit = body.submit === true;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!cycleId || !employeeId) {
    return NextResponse.json({ error: "cycleId and employeeId are required" }, { status: 400 });
  }

  const cycle = await prisma.assessmentCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.status !== "OPEN") {
    return NextResponse.json({ error: "This cycle is closed. Ask your admin to reopen it." }, { status: 400 });
  }

  const employee = await prisma.user.findFirst({
    where: { id: employeeId, managerId: session.user.id },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found or not your direct report" }, { status: 404 });
  }

  const { data, errors } = sanitizeAssessmentInput(body, MANAGER_RATING_FIELDS, MANAGER_TEXT_FIELDS);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
  }

  const uniqueWhere = {
    cycleId_managerId_employeeId: { cycleId, managerId: session.user.id, employeeId },
  };
  const existing = await prisma.managerAssessment.findUnique({ where: uniqueWhere });

  const writeData: Record<string, unknown> = { ...data };

  // Post-submission edits: allowed while the cycle is open, logged as a
  // revision, and a reason is required once the assessment has been shared.
  let revision: { before: Prisma.InputJsonObject; after: Prisma.InputJsonObject } | null = null;
  if (existing?.submittedAt) {
    const before = existing as unknown as Record<string, unknown>;
    const changed = Object.keys(data).filter((key) => (before[key] ?? null) !== data[key]);
    const auditable = changed.filter((key) => !MANAGER_RESPONSE_FIELDS.includes(key));

    if (auditable.length > 0) {
      if (existing.sharedAt && !reason) {
        return NextResponse.json(
          { error: "This assessment has been shared. Add a short reason for the change.", needsReason: true },
          { status: 400 }
        );
      }
      revision = {
        before: Object.fromEntries(auditable.map((k) => [k, (before[k] ?? null) as Prisma.InputJsonValue | null])) as Prisma.InputJsonObject,
        after: Object.fromEntries(auditable.map((k) => [k, data[k] as Prisma.InputJsonValue | null])) as Prisma.InputJsonObject,
      };
      writeData.editCount = { increment: 1 };
      writeData.lastEditedAt = new Date();
    }
  } else if (submit) {
    const merged = { ...(existing ?? {}), ...data };
    const missing = missingRequired(merged, MANAGER_REQUIRED_FIELDS);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Ratings still needed: ${missing.join(", ")}`, missing },
        { status: 400 }
      );
    }
    writeData.submittedAt = new Date();
  }

  const assessment = await prisma.$transaction(async (tx) => {
    const saved = await tx.managerAssessment.upsert({
      where: uniqueWhere,
      update: writeData,
      create: {
        cycleId,
        managerId: session.user.id,
        employeeId,
        ...data,
      },
    });
    if (revision) {
      await tx.assessmentRevision.create({
        data: {
          managerAssessmentId: saved.id,
          changedById: session.user.id,
          reason: reason || null,
          before: revision.before,
          after: revision.after,
        },
      });
    }
    return saved;
  });

  let bothComplete = false;
  if (assessment.submittedAt) {
    const selfAssessment = await prisma.selfAssessment.findFirst({
      where: { cycleId, employeeId, submittedAt: { not: null } },
    });
    bothComplete = !!selfAssessment;
  }

  return NextResponse.json({ ...assessment, bothComplete, revisionCreated: !!revision });
}
