import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/permissions";
import {
  sanitizeAssessmentInput,
  missingRequired,
  MANAGER_RATING_FIELDS,
  MANAGER_TEXT_FIELDS,
  MANAGER_REQUIRED_FIELDS,
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
    where.resultsSentAt = { not: null };
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

  if (existing?.submittedAt) {
    return NextResponse.json({ error: "Submitted assessments are locked" }, { status: 409 });
  }

  const writeData: Record<string, unknown> = { ...data };
  if (submit) {
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

  const assessment = await prisma.managerAssessment.upsert({
    where: uniqueWhere,
    update: writeData,
    create: {
      cycleId,
      managerId: session.user.id,
      employeeId,
      ...writeData,
    },
  });

  let bothComplete = false;
  if (assessment.submittedAt) {
    const selfAssessment = await prisma.selfAssessment.findFirst({
      where: { cycleId, employeeId, submittedAt: { not: null } },
    });
    bothComplete = !!selfAssessment;
  }

  return NextResponse.json({ ...assessment, bothComplete });
}
