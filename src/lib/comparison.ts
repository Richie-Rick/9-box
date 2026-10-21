// Builds the self-vs-manager comparison rows from the shared section config,
// so the summary page and My Reviews show the same dimensions and the same
// text beneath them, and a new question appears in both without edits here.

import { SECTIONS, sideLabel, type Audience, type Question } from "./assessment-sections";

export type AssessmentValues = object | null | undefined;

export interface ComparisonText {
  label: string;
  value: string | null;
}

export interface ComparisonRow {
  id: string;
  label: string;
  selfRating: number | null;
  managerRating: number | null;
  labelFn?: (r: number) => string;
  selfText?: ComparisonText[];
  managerText?: ComparisonText[];
  /** The manager's rating before the self-assessment was revealed, if it then changed. */
  managerInitial?: number | null;
}

function ratingOf(values: AssessmentValues, field: string | undefined): number | null {
  if (!values || !field) return null;
  const v = (values as Record<string, unknown>)[field];
  return typeof v === "number" ? v : null;
}

function textOf(values: AssessmentValues, field: string | undefined): string | null {
  if (!values || !field) return null;
  const v = (values as Record<string, unknown>)[field];
  return typeof v === "string" && v.trim() ? v : null;
}

function textsFor(values: AssessmentValues, questions: Question[], audience: Audience): ComparisonText[] {
  return questions
    .filter((q) => q.fields[audience])
    .map((q) => ({ label: sideLabel(q, audience), value: textOf(values, q.fields[audience]) }));
}

/**
 * One row per rating question. A section with a single rating carries its
 * text questions beneath that rating; a section with several ratings (values)
 * gets a separate text-only row; a section with no ratings is text-only.
 * `showManager` blanks the manager side (used before the review is shared).
 * `initialRatings` (manager only) marks ratings that moved after the reveal.
 */
export function buildComparisonRows(
  self: AssessmentValues,
  manager: AssessmentValues,
  { showManager = true, initialRatings }: { showManager?: boolean; initialRatings?: Record<string, number> | null } = {}
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const mgr = showManager ? manager : null;

  for (const section of SECTIONS) {
    const ratings = section.questions.filter((q) => q.kind === "rating");
    const texts = section.questions.filter((q) => q.kind === "text");
    const selfText = textsFor(self, texts, "self");
    const managerText = showManager ? textsFor(mgr, texts, "manager") : undefined;
    const hasText = selfText.some((t) => t.value) || managerText?.some((t) => t.value);

    for (const q of ratings) {
      const single = ratings.length === 1;
      const managerRating = ratingOf(mgr, q.fields.manager);
      const initial = mgr && q.fields.manager ? initialRatings?.[q.fields.manager] : undefined;
      rows.push({
        id: q.id,
        label: q.label,
        selfRating: ratingOf(self, q.fields.self),
        managerRating,
        managerInitial: typeof initial === "number" && initial !== managerRating ? initial : null,
        labelFn: q.labels ? (r: number) => q.labels![r] ?? String(r) : undefined,
        selfText: single ? selfText : undefined,
        managerText: single ? managerText : undefined,
      });
    }

    if (ratings.length !== 1 && hasText) {
      rows.push({
        id: `${section.id}.text`,
        label: ratings.length > 1 ? `${section.title} — comments` : section.title,
        selfRating: null,
        managerRating: null,
        selfText,
        managerText,
      });
    }
  }

  return rows;
}
