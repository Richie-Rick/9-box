import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager, canManageEmployee } from "@/lib/permissions";
import { notifyMeetingCompleted } from "@/lib/notifications";

// PATCH: save meeting notes; optionally mark complete (which sets the
// assessment's meetingStatus to MEETING_COMPLETE).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManager(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { notes, complete } = await request.json();

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { managerAssessment: { select: { id: true, employeeId: true } } },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  if (!(await canManageEmployee(session.user.id, session.user.role, meeting.managerAssessment.employeeId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (notes !== undefined) data.notes = notes || null;
  if (complete) data.completedAt = new Date();

  const updated = await prisma.meeting.update({
    where: { id },
    data,
    include: {
      tasks: {
        include: {
          assignee: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (complete) {
    await prisma.managerAssessment.update({
      where: { id: meeting.managerAssessment.id },
      data: { meetingStatus: "MEETING_COMPLETE" },
    });
    const assessmentId = meeting.managerAssessment.id;
    after(() => notifyMeetingCompleted(assessmentId).catch((err) => console.error("meeting_completed email failed", err)));
  }

  return NextResponse.json(updated);
}
