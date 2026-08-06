// Editable content fields for each assessment type. Lifecycle fields
// (submittedAt, lastEditedAt, unlockedAt, resultsSentAt, oneOnOne*) are
// server-managed and must never be written from a request body.
export const SELF_FIELDS = [
  "performance",
  "performanceJustification",
  "achievements",
  "blockers",
  "learning",
  "valCustomerFirst",
  "valStepIntoArena",
  "valFlockToProblems",
  "valGiveEnergy",
  "valuesReflection",
  "engagement",
  "engagementDriver",
  "supportNeeded",
  "goalsNextMonth",
] as const;

export const MANAGER_FIELDS = [
  "performance",
  "performanceEvidence",
  "growthReadiness",
  "growthReadinessEvidence",
  "valCustomerFirst",
  "valStepIntoArena",
  "valFlockToProblems",
  "valGiveEnergy",
  "valuesEvidence",
  "engagement",
  "engagementEvidence",
  "trend",
  "notes",
] as const;

/** Copies only whitelisted keys that are present in the body, so partial saves keep working. */
export function pickFields(
  body: Record<string, unknown>,
  fields: readonly string[]
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in body) data[field] = body[field];
  }
  return data;
}

/**
 * A submitted assessment stays editable by its author while the cycle is open,
 * until results are sent — after that only an admin unlock reopens it.
 */
export function canEditSubmitted(resultsSent: boolean, unlockedAt: Date | null): boolean {
  return !resultsSent || !!unlockedAt;
}
