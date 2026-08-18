import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/permissions";
import { MANAGER_ASSESSMENT_PRIORITY } from "@/lib/assessment-fields";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const cycleId = searchParams.get("cycleId");

  if (!employeeId || !cycleId) {
    return NextResponse.json({ error: "employeeId and cycleId are required" }, { status: 400 });
  }

  // Access control: the employee themselves, their manager, or leadership/admin
  const isOwnRecord = employeeId === session.user.id;
  const isManagerRole = isManager(session.user.role);
  const isLeadershipOrAdmin = session.user.role === "LEADERSHIP" || session.user.role === "ADMIN";

  if (!isOwnRecord && !isManagerRole && !isLeadershipOrAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [employee, selfAssessment, managerAssessment, cycle] = await Promise.all([
    prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, email: true, jobTitle: true, team: true, role: true, managerId: true },
    }),
    prisma.selfAssessment.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId } },
    }),
    prisma.managerAssessment.findFirst({
      where: { cycleId, employeeId },
      // A manager change can leave two rows for one cycle. Without an explicit
      // order Postgres may hand back the blank one, and a review the employee
      // was already sent reads as "Pending Manager Review".
      orderBy: [...MANAGER_ASSESSMENT_PRIORITY],
      include: {
        manager: { select: { id: true, name: true } },
        meeting: {
          include: {
            tasks: {
              include: {
                assignee: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    }),
    prisma.assessmentCycle.findUnique({ where: { id: cycleId } }),
  ]);

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Non-leadership managers can only see their own direct reports
  if (!isOwnRecord && !isLeadershipOrAdmin && employee.managerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Meeting notes are only exposed to a manager who can act on this employee.
  const canSeeMeeting = isManagerRole || isLeadershipOrAdmin;
  const mgrData = managerAssessment ? {
    ...managerAssessment,
    meeting: canSeeMeeting ? managerAssessment.meeting : null,
  } : null;

  return NextResponse.json({
    employee,
    cycle,
    selfAssessment,
    managerAssessment: mgrData,
  });
}
