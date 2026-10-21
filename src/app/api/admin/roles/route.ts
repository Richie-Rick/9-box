import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";

/** Roles with their templates and the people they apply to. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roles = await prisma.jobRole.findMany({
    include: {
      users: { where: { isActive: true }, select: { id: true, name: true, team: true }, orderBy: { name: "asc" } },
      metricTemplates: { orderBy: { createdAt: "asc" }, include: { _count: { select: { metrics: true } } } },
      goalTemplates: { orderBy: { createdAt: "asc" }, include: { _count: { select: { goals: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(roles);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await request.json();
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const existing = await prisma.jobRole.findFirst({ where: { name: { equals: trimmed, mode: "insensitive" } } });
  if (existing) {
    return NextResponse.json({ error: "A role with that name already exists" }, { status: 409 });
  }

  const role = await prisma.jobRole.create({ data: { name: trimmed } });
  return NextResponse.json(role, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { roleId, name, isActive } = await request.json();
  if (!roleId) {
    return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof isActive === "boolean") data.isActive = isActive;

  const role = await prisma.jobRole.update({ where: { id: roleId }, data });

  // Keep the display title in sync when a role is renamed.
  if (data.name) {
    await prisma.user.updateMany({ where: { jobRoleId: roleId }, data: { jobTitle: role.name } });
  }

  return NextResponse.json(role);
}
