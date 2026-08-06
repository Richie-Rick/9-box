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
