import { diffFields } from "./audit";
import { MANAGER_ASSESSMENT_FIELDS, MANAGER_RESPONSE_FIELDS } from "./assessment-fields";

// Fields a manager may still change once the review is shared without giving
// a reason: their responses to the employee's comments.
const NO_REASON_NEEDED = new Set(MANAGER_RESPONSE_FIELDS);

/**
 * Once a review has been shared with the employee, any change to a rating or
 * comment (anything other than a response) needs a short reason, which goes
 * into the audit summary so the employee can see why it moved.
 * Returns the fields that would change and whether a reason is required.
 */
export function sharedEditCheck(
  existing: Record<string, unknown>,
  content: Record<string, unknown>
): { changed: string[]; needsReason: boolean } {
  const merged = { ...existing, ...content };
  const changed = Object.keys(diffFields(existing, merged, MANAGER_ASSESSMENT_FIELDS));
  const needsReason = !!existing.sharedAt && changed.some((f) => !NO_REASON_NEEDED.has(f));
  return { changed, needsReason };
}

export function cleanReason(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : null;
}
