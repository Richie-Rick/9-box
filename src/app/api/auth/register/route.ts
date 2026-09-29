import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureJobRole, syncTemplateGoalsForUser } from "@/lib/job-roles";

export async function POST(request: Request) {
  try {
    const { name, email, password, token } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // If invite token provided, use invitation data for role/manager
    if (token) {
      const invitation = await prisma.invitation.findUnique({ where: { token } });
      if (!invitation) {
        return NextResponse.json({ error: "Invalid invitation link" }, { status: 400 });
      }
      if (invitation.usedAt) {
        return NextResponse.json({ error: "This invitation has already been used" }, { status: 400 });
      }
      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json({ error: "Email does not match the invitation" }, { status: 400 });
      }

      const jobRole = await ensureJobRole(invitation.jobTitle);
      const user = await prisma.user.create({
        data: {
          name: name || invitation.name,
          email: invitation.email,
          passwordHash,
          jobTitle: jobRole?.name ?? invitation.jobTitle,
          jobRoleId: jobRole?.id ?? null,
          team: invitation.team,
          role: invitation.role,
          managerId: invitation.managerId,
        },
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
      await syncTemplateGoalsForUser(user.id);

      return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
    }

    // No token: look up pending invitation by email
    const invitation = await prisma.invitation.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, usedAt: null },
    });

    if (invitation) {
      const jobRole = await ensureJobRole(invitation.jobTitle);
      const user = await prisma.user.create({
        data: {
          name: name || invitation.name,
          email: invitation.email,
          passwordHash,
          jobTitle: jobRole?.name ?? invitation.jobTitle,
          jobRoleId: jobRole?.id ?? null,
          team: invitation.team,
          role: invitation.role,
          managerId: invitation.managerId,
        },
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
      await syncTemplateGoalsForUser(user.id);

      return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
    }

    // No token, no invitation: open registration (default EMPLOYEE)
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
