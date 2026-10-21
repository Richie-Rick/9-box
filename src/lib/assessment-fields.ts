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

// Ratings that must be set before an assessment can be submitted. Text is
// optional; a submitted assessment with a missing rating would otherwise be
// counted as done but silently dropped from the 9-box and Analysis.
export const MANAGER_REQUIRED_FIELDS = [
  "performance", "growthReadiness",
  "valCustomerFirst", "valStepIntoArena", "valFlockToProblems", "valGiveEnergy",
  "engagement",
];

export const SELF_REQUIRED_FIELDS = [
  "performance",
  "valCustomerFirst", "valStepIntoArena", "valFlockToProblems", "valGiveEnergy",
  "engagement",
];

export const FIELD_LABELS: Record<string, string> = {
  performance: "Performance",
  growthReadiness: "Growth Readiness",
  valCustomerFirst: "Customer First",
  valStepIntoArena: "Step Into the Arena",
  valFlockToProblems: "Flock to Problems",
  valGiveEnergy: "Give Energy",
  engagement: "Engagement",
};

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

/** Labels of the required fields that have no value in `values`. */
export function missingRequired(values: Record<string, unknown>, required: string[]): string[] {
  return required
    .filter((f) => values[f] === null || values[f] === undefined || values[f] === "")
    .map((f) => FIELD_LABELS[f] ?? f);
}
