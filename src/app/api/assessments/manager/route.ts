import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/permissions";
import { maybeMarkReadyToMeet } from "@/lib/meeting-server";
import { logAudit, diffFields } from "@/lib/audit";
import { MANAGER_ASSESSMENT_FIELDS, pickFields } from "@/lib/assessment-fields";

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

  // Managers see their own assessments; leadership/admin see all
  if (session.user.role === "MANAGER" || session.user.role === "AREA_LEAD") {
    where.managerId = session.user.id;
  }

  const assessments = await prisma.managerAssessment.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true, role: true, team: true, jobTitle: true, startDate: true } },
      manager: { select: { id: true, name: true } },
      cycle: true,
    },
    orderBy: { createdAt: "desc" },
  });

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

  const body = await request.json();
  const { cycleId, employeeId, ...data } = body;

  if (!cycleId || !employeeId) {
    return NextResponse.json({ error: "cycleId and employeeId are required" }, { status: 400 });
  }

  const isElevated = session.user.role === "LEADERSHIP" || session.user.role === "ADMIN";

  // Find the row being written: the caller's own assessment, or — for
  // leadership/admin correcting someone else's review — the owning manager's.
  let existing = await prisma.managerAssessment.findUnique({
    where: {
      cycleId_managerId_employeeId: { cycleId, managerId: session.user.id, employeeId },
    },
  });
  if (!existing && isElevated) {
    existing = await prisma.managerAssessment.findFirst({
      where: { cycleId, employeeId },
      orderBy: { createdAt: "desc" },
    });
  }

  // Writing your own assessment requires the employee to be a direct report.
  if (!existing || existing.managerId === session.user.id) {
    const employee = await prisma.user.findFirst({
      where: { id: employeeId, managerId: session.user.id },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found or not your direct report" }, { status: 404 });
    }
  }

  // The cycle must be OPEN to CREATE a brand-new assessment. An existing
  // assessment can be edited at any point — even after the cycle is closed.
  if (!existing) {
    const cycle = await prisma.assessmentCycle.findUnique({ where: { id: cycleId } });
    if (!cycle || cycle.status !== "OPEN") {
      return NextResponse.json({ error: "Cycle is not open" }, { status: 400 });
    }
  }

  // Once results have been sent the assessment is locked — no further edits.
  if (existing?.resultsSentAt) {
    return NextResponse.json(
      { error: "Results have already been sent; this assessment is locked." },
      { status: 409 }
    );
  }

  // Only whitelisted content fields are written. submittedAt is stamped
  // server-side: set once when the client submits, never cleared or
  // overwritten with a client-supplied timestamp.
  const content = pickFields(data, MANAGER_ASSESSMENT_FIELDS);
  const wantsSubmit = Boolean(data.submittedAt);

  const assessment = existing
    ? await prisma.managerAssessment.update({
        where: { id: existing.id },
        data: {
          ...content,
          ...(wantsSubmit && !existing.submittedAt ? { submittedAt: new Date() } : {}),
          updatedAt: new Date(),
        },
      })
    : await prisma.managerAssessment.create({
        data: {
          cycleId,
          managerId: session.user.id,
          employeeId,
          ...content,
          ...(wantsSubmit ? { submittedAt: new Date() } : {}),
        },
      });

  // Editing an already-completed (submitted) assessment before results are sent
  // is allowed but recorded in the audit trail.
  if (existing?.submittedAt) {
    const changes = diffFields(
      existing as unknown as Record<string, unknown>,
      assessment as unknown as Record<string, unknown>,
      MANAGER_ASSESSMENT_FIELDS
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
        entityType: "ManagerAssessment",
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
    const selfAssessment = await prisma.selfAssessment.findFirst({
      where: { cycleId, employeeId, submittedAt: { not: null } },
    });
    bothComplete = !!selfAssessment;
    await maybeMarkReadyToMeet(cycleId, employeeId);
  }

  return NextResponse.json({ ...assessment, bothComplete });
}
