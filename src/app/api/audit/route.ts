import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/permissions";

// Returns the audit trail for a given entity. Managers/admins can read any
// trail. A non-manager may read the trail for their OWN SelfAssessment only.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
  }

  if (!isManager(session.user.role)) {
    // The only trail a non-manager may view is their own self-assessment's.
    if (entityType !== "SelfAssessment") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const selfAssessment = await prisma.selfAssessment.findUnique({
      where: { id: entityId },
      select: { employeeId: true },
    });
    if (!selfAssessment || selfAssessment.employeeId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const logs = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(logs);
}
