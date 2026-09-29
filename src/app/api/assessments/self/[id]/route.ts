import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sanitizeAssessmentInput,
  SELF_RATING_FIELDS,
  SELF_TEXT_FIELDS,
} from "@/lib/assessment-fields";

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

  const existing = await prisma.selfAssessment.findUnique({
    where: { id },
    include: { cycle: true },
  });
  if (!existing || existing.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  }
  if (existing.cycle.status !== "OPEN") {
    return NextResponse.json({ error: "This cycle is closed. Ask your admin to reopen it." }, { status: 400 });
  }
  if (existing.submittedAt) {
    return NextResponse.json({ error: "Submitted assessments are locked" }, { status: 409 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const { data, errors } = sanitizeAssessmentInput(body, SELF_RATING_FIELDS, SELF_TEXT_FIELDS);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
  }

  const assessment = await prisma.selfAssessment.update({
    where: { id },
    data,
  });

  return NextResponse.json(assessment);
}
