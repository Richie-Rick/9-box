// The content fields a client is allowed to write on each assessment type.
// Assessment writes are whitelisted to these fields (submittedAt is stamped
// server-side, never taken from the client), and post-submission edits to them
// are what the audit trail records. Everything derives from the shared
// section config so a question added there is writable here.

import { fieldsFor } from "./assessment-sections";

const manager = fieldsFor("manager");
const self = fieldsFor("self");

// `trend` is set from the manager form's summary, not a section question.
export const MANAGER_ASSESSMENT_FIELDS = [...manager.rating, ...manager.text, "trend"];

export const SELF_ASSESSMENT_FIELDS = [...self.rating, ...self.text];

// Ratings that must be set before an assessment can be submitted. Text is
// optional; a submitted assessment with a missing rating would otherwise be
// counted as done but silently dropped from the 9-box and Analysis.
export const MANAGER_REQUIRED_FIELDS = manager.required;

export const SELF_REQUIRED_FIELDS = self.required;

export const FIELD_LABELS: Record<string, string> = { ...self.labels, ...manager.labels };

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
