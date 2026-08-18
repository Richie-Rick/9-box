import { prisma } from "./prisma";
import { MANAGER_ASSESSMENT_PRIORITY } from "./assessment-fields";

/**
 * When BOTH the self and manager assessments for a cycle/employee are submitted,
 * advance the manager assessment's meetingStatus from NOT_READY to READY_TO_MEET.
 * No-op once a manager has moved the card further along.
 * Call after either assessment is submitted.
 */
export async function maybeMarkReadyToMeet(cycleId: string, employeeId: string): Promise<void> {
  const [self, mgr] = await Promise.all([
    prisma.selfAssessment.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId } },
      select: { submittedAt: true },
    }),
    prisma.managerAssessment.findFirst({
      where: { cycleId, employeeId },
      orderBy: [...MANAGER_ASSESSMENT_PRIORITY],
      select: { id: true, submittedAt: true, meetingStatus: true },
    }),
  ]);

  if (!mgr) return;
  const bothSubmitted = !!self?.submittedAt && !!mgr.submittedAt;
  if (bothSubmitted && mgr.meetingStatus === "NOT_READY") {
    await prisma.managerAssessment.update({
      where: { id: mgr.id },
      data: { meetingStatus: "READY_TO_MEET" },
    });
  }
}
