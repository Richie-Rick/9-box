import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SECTIONS, sectionRatingFields } from "@/lib/assessment-sections";

/**
 * Reveals the employee's self-assessment answers for one section to their
 * manager, but only after the manager has saved their own rating(s) for that
 * section, so the self-assessment never anchors the manager's view. The first
 * reveal snapshots the manager's current ratings into `initialRatings`, so
 * later adjustments can be compared against them on the summary.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycleId");
  const employeeId = searchParams.get("employeeId");
  const sectionId = searchParams.get("section");

  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!cycleId || !employeeId || !section) {
    return NextResponse.json({ error: "cycleId, employeeId and a valid section are required" }, { status: 400 });
  }

  // The caller's own assessment, or — for leadership/admin working on someone
  // else's review — the owning manager's.
  const isElevated = session.user.role === "LEADERSHIP" || session.user.role === "ADMIN";
  let managerAssessment = await prisma.managerAssessment.findUnique({
    where: { cycleId_managerId_employeeId: { cycleId, managerId: session.user.id, employeeId } },
  });
  if (!managerAssessment && isElevated) {
    managerAssessment = await prisma.managerAssessment.findFirst({
      where: { cycleId, employeeId },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!managerAssessment) {
    return NextResponse.json({ error: "Save your assessment first" }, { status: 404 });
  }

  const ratingFields = sectionRatingFields(section.id, "manager");
  const record = managerAssessment as unknown as Record<string, unknown>;
  const unrated = ratingFields.filter((f) => record[f] === null || record[f] === undefined);
  if (unrated.length > 0) {
    return NextResponse.json(
      { error: "Rate this section before seeing what they said", unrated },
      { status: 409 }
    );
  }

  const selfAssessment = await prisma.selfAssessment.findUnique({
    where: { cycleId_employeeId: { cycleId, employeeId } },
  });

  if (!selfAssessment?.submittedAt) {
    return NextResponse.json({ submitted: false, answers: null });
  }

  // Snapshot this section's ratings on first reveal.
  const initial = (managerAssessment.initialRatings as Record<string, number> | null) ?? {};
  const missingSnapshot = ratingFields.filter((f) => !(f in initial));
  if (missingSnapshot.length > 0) {
    const next = { ...initial };
    for (const f of missingSnapshot) next[f] = record[f] as number;
    await prisma.managerAssessment.update({
      where: { id: managerAssessment.id },
      data: { initialRatings: next },
    });
  }

  const selfRecord = selfAssessment as unknown as Record<string, unknown>;
  const answers: Record<string, unknown> = {};
  for (const q of section.questions) {
    const field = q.fields.self;
    if (field) answers[field] = selfRecord[field] ?? null;
  }

  return NextResponse.json({ submitted: true, answers });
}
