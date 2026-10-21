import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { ensureJobRole, syncTemplatesForUser } from "@/lib/job-roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      jobTitle: true,
      team: true,
      role: true,
      isActive: true,
      managerId: true,
      startDate: true,
      createdAt: true,
      jobRoleId: true,
      manager: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, role, managerId, isActive, jobTitle, team, startDate } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Prevent self-role-change
  if (userId === session.user.id && role !== undefined) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (role !== undefined) data.role = role;
  if (managerId !== undefined) data.managerId = managerId || null;
  if (isActive !== undefined) data.isActive = isActive;
  if (jobTitle !== undefined) {
    // The job title doubles as the job role; role-set templates follow it.
    const jobRole = await ensureJobRole(jobTitle);
    data.jobTitle = jobRole?.name ?? null;
    data.jobRoleId = jobRole?.id ?? null;
  }
  if (team !== undefined) data.team = team || null;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, jobTitle: true, jobRoleId: true, team: true, role: true, isActive: true, managerId: true, startDate: true },
  });

  // A new role, team or reactivation can owe the person role-set goals and metrics.
  if (jobTitle !== undefined || team !== undefined || isActive === true) {
    await syncTemplatesForUser(userId);
  }

  return NextResponse.json(user);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  // Unassign any reports that point to this user as manager
  await prisma.user.updateMany({
    where: { managerId: userId },
    data: { managerId: null },
  });

  // Delete all related data (cascades handle assessments, goals, metrics)
  await prisma.selfAssessment.deleteMany({ where: { employeeId: userId } });
  await prisma.managerAssessment.deleteMany({ where: { OR: [{ employeeId: userId }, { managerId: userId }] } });
  await prisma.goal.deleteMany({ where: { OR: [{ employeeId: userId }, { createdById: userId }] } });
  await prisma.keyMetric.deleteMany({ where: { OR: [{ employeeId: userId }, { createdById: userId }] } });
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true });
}
