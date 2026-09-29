import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/permissions";
import { notifyReviewShared } from "@/lib/notifications";

/**
 * Shares the manager's submitted assessment with the employee ahead of the
 * 1:1. The self-assessment does not have to be in yet; the client warns.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManager(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { assessmentId } = await request.json();
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  const assessment = await prisma.managerAssessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }
  if (assessment.managerId !== session.user.id) {
    return NextResponse.json({ error: "Not your assessment" }, { status: 403 });
  }
  if (!assessment.submittedAt) {
    return NextResponse.json({ error: "Submit your assessment before sharing it" }, { status: 400 });
  }
  if (assessment.sharedAt) {
    return NextResponse.json({ error: "Already shared" }, { status: 400 });
  }

  const updated = await prisma.managerAssessment.update({
    where: { id: assessmentId },
    data: { sharedAt: new Date() },
  });

  after(() => notifyReviewShared(updated.id).catch((err) => console.error("review_shared email failed", err)));

  return NextResponse.json({ sharedAt: updated.sharedAt });
}
