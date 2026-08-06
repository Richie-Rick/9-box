import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { type, id, action } = body;

  if (type !== "self" && type !== "manager") {
    return NextResponse.json({ error: "type must be 'self' or 'manager'" }, { status: 400 });
  }
  if (action !== "unlock" && action !== "lock") {
    return NextResponse.json({ error: "action must be 'unlock' or 'lock'" }, { status: 400 });
  }
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data = { unlockedAt: action === "unlock" ? new Date() : null };

  if (type === "self") {
    const existing = await prisma.selfAssessment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    const updated = await prisma.selfAssessment.update({ where: { id }, data });
    return NextResponse.json({ id: updated.id, unlockedAt: updated.unlockedAt });
  }

  const existing = await prisma.managerAssessment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }
  const updated = await prisma.managerAssessment.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id, unlockedAt: updated.unlockedAt });
}
