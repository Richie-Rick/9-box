import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureJobRole, syncTemplatesForUser } from "@/lib/job-roles";

// An invitation's `managerId` carries no foreign key (see migration 0003), so it
// can point at a user who has since been removed. Copying a stale id straight
// into `User.create` would trip the User.managerId FK and fail the whole
// registration. Resolve it to null when the referenced manager no longer exists.
async function resolveManagerId(managerId: string | null): Promise<string | null> {
  if (!managerId) return null;
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { id: true },
  });
  return manager ? managerId : null;
}

// Build the create payload for an invited user, OMITTING any optional field that
// has no value rather than passing it as an explicit `null`.
//
// Why: production's `User` table drifted from this schema (it was first created
// with `prisma db push` from an older schema — see migration 0016). On prod,
// `jobTitle`/`team` carry a NOT NULL constraint with a default, so sending an
// explicit `null` trips a `P2011` null-constraint violation, whereas omitting
// the field lets the column default apply. Invitations very often have no
// jobTitle/team (they default to null when an admin invites without them), so
// the invite registration path used to 500 for those users. Omitting null
// values mirrors how the open-registration path already behaves and keeps the
// route resilient to the column drift.
function buildInvitedUserData(params: {
  name: string;
  email: string;
  passwordHash: string;
  jobTitle: string | null;
  team: string | null;
  role: Prisma.UserUncheckedCreateInput["role"];
  managerId: string | null;
}): Prisma.UserUncheckedCreateInput {
  return {
    name: params.name,
    email: params.email,
    passwordHash: params.passwordHash,
    role: params.role,
    isActive: true,
    ...(params.jobTitle ? { jobTitle: params.jobTitle } : {}),
    ...(params.team ? { team: params.team } : {}),
    ...(params.managerId ? { managerId: params.managerId } : {}),
  };
}

// Links a new account to the job role named by its title and gives it that
// role's role-set goals and metrics. Best-effort: never blocks registration.
async function attachJobRole(userId: string, jobTitle: string | null | undefined): Promise<void> {
  try {
    const jobRole = await ensureJobRole(jobTitle);
    if (!jobRole) return;
    await prisma.user.update({ where: { id: userId }, data: { jobRoleId: jobRole.id } });
    await syncTemplatesForUser(userId);
  } catch (err) {
    console.error("Failed to attach job role", err);
  }
}

export async function POST(request: Request) {
  try {
    const { name, email, password, token } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Store and look up emails in a single canonical (lowercased, trimmed) form.
    // Email is case-insensitive, so keeping one casing prevents near-duplicate
    // accounts and the login mismatches that come from storing mixed casing.
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
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
      if (invitation.email.toLowerCase() !== normalizedEmail) {
        return NextResponse.json({ error: "Email does not match the invitation" }, { status: 400 });
      }

      const user = await prisma.user.create({
        data: buildInvitedUserData({
          name: name || invitation.name,
          email: invitation.email.toLowerCase(),
          passwordHash,
          jobTitle: invitation.jobTitle,
          team: invitation.team,
          role: invitation.role,
          managerId: await resolveManagerId(invitation.managerId),
        }),
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
      await attachJobRole(user.id, invitation.jobTitle);

      return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
    }

    // No token: look up pending invitation by email
    const invitation = await prisma.invitation.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" }, usedAt: null },
    });

    if (invitation) {
      const user = await prisma.user.create({
        data: buildInvitedUserData({
          name: name || invitation.name,
          email: invitation.email.toLowerCase(),
          passwordHash,
          jobTitle: invitation.jobTitle,
          team: invitation.team,
          role: invitation.role,
          managerId: await resolveManagerId(invitation.managerId),
        }),
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
      await attachJobRole(user.id, invitation.jobTitle);

      return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
    }

    // No token, no invitation: open registration (default EMPLOYEE)
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: { name, email: normalizedEmail, passwordHash, isActive: true },
    });

    return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
  } catch (error) {
    // Surface the real cause in the server logs — the previous bare `catch`
    // collapsed every failure into an opaque "Internal server error" with no
    // way to diagnose it from the Vercel runtime logs.
    console.error("Registration failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
