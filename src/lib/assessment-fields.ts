// Field whitelists and validation for assessment writes, derived from the
// shared section definition so the server and the forms cannot drift.

import { fieldsFor, questionsFor } from "./assessment-sections";

const managerFields = fieldsFor("manager");
const selfFields = fieldsFor("self");

export const MANAGER_RATING_FIELDS: readonly string[] = managerFields.rating;
export const MANAGER_TEXT_FIELDS: readonly string[] = managerFields.text;
export const MANAGER_REQUIRED_FIELDS: readonly string[] = managerFields.required;
/** Manager response fields stay editable after submission (they reply to the self-review). */
export const MANAGER_RESPONSE_FIELDS: readonly string[] = managerFields.response;

export const SELF_RATING_FIELDS: readonly string[] = selfFields.rating;
export const SELF_TEXT_FIELDS: readonly string[] = selfFields.text;
export const SELF_REQUIRED_FIELDS: readonly string[] = selfFields.required;

export const FIELD_LABELS: Record<string, string> = (() => {
  const labels: Record<string, string> = {};
  for (const audience of ["self", "manager"] as const) {
    for (const { question } of questionsFor(audience)) {
      labels[question.fields[audience]!] = question.label;
    }
  }
  return labels;
})();

export const MAX_TEXT_LENGTH = 5000;

export interface SanitizeResult {
  data: Record<string, number | string | null>;
  errors: string[];
}

/**
 * Picks only the allowed fields from an untrusted body and validates them.
 * Ratings must be an integer 1..3 or null. Text must be a string (trimmed,
 * capped) or null. Unknown keys are dropped silently.
 */
export function sanitizeAssessmentInput(
  body: Record<string, unknown>,
  ratingFields: readonly string[],
  textFields: readonly string[]
): SanitizeResult {
  const data: Record<string, number | string | null> = {};
  const errors: string[] = [];

  for (const field of ratingFields) {
    if (!(field in body)) continue;
    const value = body[field];
    if (value === null || value === undefined || value === "") {
      data[field] = null;
    } else if (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 3) {
      data[field] = value as number;
    } else {
      errors.push(`${FIELD_LABELS[field] ?? field} must be a rating from 1 to 3`);
    }
  }

  for (const field of textFields) {
    if (!(field in body)) continue;
    const value = body[field];
    if (value === null || value === undefined) {
      data[field] = null;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      data[field] = trimmed.length === 0 ? null : trimmed.slice(0, MAX_TEXT_LENGTH);
    } else {
      errors.push(`${field} must be text`);
    }
  }

  return { data, errors };
}

/** Returns the labels of required fields that have no value. */
export function missingRequired(
  values: Record<string, unknown>,
  required: readonly string[]
): string[] {
  return required
    .filter((field) => values[field] === null || values[field] === undefined || values[field] === "")
    .map((field) => FIELD_LABELS[field] ?? field);
}
