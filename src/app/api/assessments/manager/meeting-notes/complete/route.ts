import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyMeetingCompleted } from "@/lib/notifications";

/** Marks the 1:1 as held. Notes and agreed actions become visible to the employee. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!assessment.submittedAt) {
    return NextResponse.json({ error: "Submit the assessment before completing the 1:1" }, { status: 400 });
  }

  const updated = await prisma.managerAssessment.update({
    where: { id: assessmentId },
    data: {
      oneOnOneComplete: true,
      oneOnOneCompletedAt: assessment.oneOnOneCompletedAt ?? new Date(),
      // Sharing is implied by holding the meeting
      sharedAt: assessment.sharedAt ?? new Date(),
    },
    select: { id: true, oneOnOneComplete: true, oneOnOneCompletedAt: true, sharedAt: true },
  });

  after(() => notifyMeetingCompleted(updated.id).catch((err) => console.error("meeting_completed email failed", err)));

  return NextResponse.json(updated);
}
