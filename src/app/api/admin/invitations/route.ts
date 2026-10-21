import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { sendInviteEmail, buildInviteUrl } from "@/lib/email";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invitations);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, role, managerId, jobTitle, team } = await request.json();

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  // Store emails in one canonical (lowercased, trimmed) form so users created
  // from this invitation can always be matched at login regardless of casing.
  const normalizedEmail = (email as string).trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const token = randomBytes(32).toString("hex");

  const invitation = await prisma.invitation.create({
    data: {
      name,
      email: normalizedEmail,
      jobTitle: jobTitle || null,
      team: team || null,
      role: role || "EMPLOYEE",
      managerId: managerId || null,
      token,
    },
  });

  const inviteUrl = buildInviteUrl(invitation.token);
  const emailResult = await sendInviteEmail({
    to: invitation.email,
    recipientName: invitation.name,
    inviteUrl,
  });

  return NextResponse.json(
    { ...invitation, emailSent: emailResult.success },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { invitationId } = await request.json();
  if (!invitationId) {
    return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.usedAt) {
    return NextResponse.json({ error: "Invitation not found or already used" }, { status: 404 });
  }

  const inviteUrl = buildInviteUrl(invitation.token);
  const emailResult = await sendInviteEmail({
    to: invitation.email,
    recipientName: invitation.name,
    inviteUrl,
  });

  return NextResponse.json({ success: emailResult.success, error: emailResult.error });
}
