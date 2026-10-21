import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maybeMarkReadyToMeet } from "@/lib/meeting-server";
import { logAudit, diffFields } from "@/lib/audit";
import { SELF_ASSESSMENT_FIELDS, pickFields } from "@/lib/assessment-fields";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const assessment = await prisma.selfAssessment.findUnique({
    where: { id },
    include: { cycle: true, employee: { select: { id: true, name: true } } },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the employee themselves, their manager, or leadership/admin can view
  if (assessment.employeeId !== session.user.id) {
    const employee = await prisma.user.findUnique({
      where: { id: assessment.employeeId },
      select: { managerId: true },
    });
    const isTheirManager = employee?.managerId === session.user.id;
    const isLeadership = session.user.role === "LEADERSHIP" || session.user.role === "ADMIN";

    if (!isTheirManager && !isLeadership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(assessment);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.selfAssessment.findUnique({ where: { id } });
  const isElevated = session.user.role === "LEADERSHIP" || session.user.role === "ADMIN";
  if (!existing || (existing.employeeId !== session.user.id && !isElevated)) {
    return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  }

  const body = await request.json();

  // Only whitelisted content fields are written. submittedAt is stamped
  // server-side: set once when the client submits, never cleared or
  // overwritten with a client-supplied timestamp.
  const content = pickFields(body, SELF_ASSESSMENT_FIELDS);
  const wantsSubmit = Boolean(body.submittedAt);

  const assessment = await prisma.selfAssessment.update({
    where: { id },
    data: {
      ...content,
      ...(wantsSubmit && !existing.submittedAt ? { submittedAt: new Date() } : {}),
    },
  });

  // Editing an already-completed (submitted) self-assessment is allowed but
  // recorded in the audit trail.
  if (existing.submittedAt) {
    const changes = diffFields(
      existing as unknown as Record<string, unknown>,
      assessment as unknown as Record<string, unknown>,
      SELF_ASSESSMENT_FIELDS
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
        entityType: "SelfAssessment",
        entityId: assessment.id,
        summary: `Edited after completion: ${changed.join(", ")}`,
        before,
        after,
      });
    }
  }

  // Once both self + manager assessments are submitted, the employee is Ready to Meet.
  if (assessment.submittedAt) {
    await maybeMarkReadyToMeet(assessment.cycleId, assessment.employeeId);
  }

  return NextResponse.json(assessment);
}
