// The content fields a client is allowed to write on each assessment type.
// Assessment writes are whitelisted to these fields (submittedAt is stamped
// server-side, never taken from the client), and post-submission edits to them
// are what the audit trail records.

export const MANAGER_ASSESSMENT_FIELDS = [
  "performance", "performanceEvidence",
  "growthReadiness", "growthReadinessEvidence",
  "valCustomerFirst", "valStepIntoArena", "valFlockToProblems", "valGiveEnergy",
  "valuesEvidence", "engagement", "engagementEvidence", "trend", "notes",
];

export const SELF_ASSESSMENT_FIELDS = [
  "performance", "performanceJustification", "achievements", "blockers", "learning",
  "valCustomerFirst", "valStepIntoArena", "valFlockToProblems", "valGiveEnergy",
  "valuesReflection", "engagement", "engagementDriver", "supportNeeded", "goalsNextMonth",
];

export function pickFields(
  data: Record<string, unknown>,
  fields: string[]
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in data) picked[f] = data[f];
  }
  return picked;
}

/**
 * A manager assessment is locked against edits once results have been sent —
 * unless a manager has explicitly re-opened it. Unlocking deliberately leaves
 * `resultsSentAt` intact so the employee keeps seeing the review they were
 * already shown; use the withdraw action to actually retract it.
 */
export function isAssessmentLocked(assessment: {
  resultsSentAt: Date | null;
  unlockedAt: Date | null;
}): boolean {
  return !!assessment.resultsSentAt && !assessment.unlockedAt;
}

/**
 * The unique key on ManagerAssessment includes managerId, so a manager change
 * can leave two rows for one (cycle, employee) — a populated one from the old
 * manager and a blank one from the new. Any read that picks a single row must
 * prefer the row that actually holds the review, otherwise a shared result can
 * silently disappear from the employee's view.
 */
export const MANAGER_ASSESSMENT_PRIORITY = [
  { resultsSentAt: { sort: "desc", nulls: "last" } },
  { submittedAt: { sort: "desc", nulls: "last" } },
  { updatedAt: "desc" },
] as const;
