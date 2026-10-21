import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllAssessments } from "@/lib/permissions";
import { buildIcs, defaultMeetingSlot, googleCalendarUrl } from "@/lib/ics";
import { formatCyclePeriod } from "@/lib/utils";
import { getAppUrl } from "@/lib/email";

/**
 * Calendar entry for the 1:1. `?format=ics` downloads a file; otherwise a
 * JSON body with the Google Calendar template link.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const assessmentId = searchParams.get("assessmentId");
  const format = searchParams.get("format");
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  const a = await prisma.managerAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      manager: { select: { id: true, name: true, email: true } },
      cycle: true,
    },
  });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = a.managerId === session.user.id || a.employeeId === session.user.id || canViewAllAssessments(session.user.role);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const period = formatCyclePeriod(a.cycle);
  const slot = defaultMeetingSlot();
  const event = {
    uid: `${a.id}@visory-performance`,
    title: `1:1 performance conversation: ${a.employee.name} and ${a.manager.name}`,
    description: `Review of ${period}.\nAgenda: goals and results, what you both said, actions, notes.\nMeeting page: ${getAppUrl()}/meeting/${a.id}`,
    start: slot.start,
    end: slot.end,
    attendees: [a.employee.email, a.manager.email],
  };

  if (format === "ics") {
    return new NextResponse(buildIcs(event), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="1-1-${a.employee.name.replace(/\s+/g, "-").toLowerCase()}.ics"`,
      },
    });
  }

  const guests = session.user.id === a.managerId ? [a.employee.email] : [a.manager.email];
  return NextResponse.json({ googleUrl: googleCalendarUrl({ ...event, attendees: guests }) });
}
