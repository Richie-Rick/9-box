import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sanitizeAssessmentInput,
  MANAGER_RATING_FIELDS,
  MANAGER_TEXT_FIELDS,
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

  const assessment = await prisma.managerAssessment.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      manager: { select: { id: true, name: true } },
      cycle: true,
    },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    assessment.managerId !== session.user.id &&
    session.user.role !== "LEADERSHIP" &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const existing = await prisma.managerAssessment.findUnique({
    where: { id },
    include: { cycle: true },
  });
  if (!existing || existing.managerId !== session.user.id) {
    return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  }
  if (existing.cycle.status !== "OPEN") {
    return NextResponse.json({ error: "This cycle is closed. Ask your admin to reopen it." }, { status: 400 });
  }
  if (existing.submittedAt) {
    return NextResponse.json({ error: "Submitted assessments are locked" }, { status: 409 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const { data, errors } = sanitizeAssessmentInput(body, MANAGER_RATING_FIELDS, MANAGER_TEXT_FIELDS);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
  }

  const assessment = await prisma.managerAssessment.update({
    where: { id },
    data,
  });

  return NextResponse.json(assessment);
}
