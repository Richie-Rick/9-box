import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllAssessments } from "@/lib/permissions";
import { FIELD_LABELS } from "@/lib/assessment-fields";

/** The audit log of post-submission edits: manager who wrote it, or leadership. */
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
    select: { managerId: true },
  });
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (assessment.managerId !== session.user.id && !canViewAllAssessments(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const revisions = await prisma.assessmentRevision.findMany({
    where: { managerAssessmentId: id },
    include: { changedBy: { select: { id: true, name: true } } },
    orderBy: { changedAt: "desc" },
  });

  return NextResponse.json(
    revisions.map((r) => {
      const before = r.before as Record<string, unknown>;
      const after = r.after as Record<string, unknown>;
      return {
        id: r.id,
        changedAt: r.changedAt,
        changedBy: r.changedBy,
        reason: r.reason,
        changes: Object.keys(after).map((field) => ({
          field,
          label: FIELD_LABELS[field] ?? field,
          before: before[field] ?? null,
          after: after[field] ?? null,
        })),
      };
    })
  );
}
