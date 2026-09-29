import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  sanitizeAssessmentInput,
  MANAGER_RATING_FIELDS,
  MANAGER_TEXT_FIELDS,
  MANAGER_RESPONSE_FIELDS,
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
  const body = (await request.json()) as Record<string, unknown>;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const { data, errors } = sanitizeAssessmentInput(body, MANAGER_RATING_FIELDS, MANAGER_TEXT_FIELDS);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
  }

  const writeData: Record<string, unknown> = { ...data };
  let revision: { before: Prisma.InputJsonObject; after: Prisma.InputJsonObject } | null = null;
  if (existing.submittedAt) {
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
  }

  const assessment = await prisma.$transaction(async (tx) => {
    const saved = await tx.managerAssessment.update({ where: { id }, data: writeData });
    if (revision) {
      await tx.assessmentRevision.create({
        data: {
          managerAssessmentId: id,
          changedById: session.user.id,
          reason: reason || null,
          before: revision.before,
          after: revision.after,
        },
      });
    }
    return saved;
  });

  return NextResponse.json(assessment);
}
