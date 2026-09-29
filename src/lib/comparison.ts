// Builds the side-by-side comparison rows for the summary, My Reviews and
// meeting views from the shared section definition.

import { SECTIONS, type Question } from "./assessment-sections";

export interface ComparisonText {
  label: string;
  value: string | null;
}

export interface ComparisonRow {
  id: string;
  sectionId: string;
  sectionTitle: string;
  label: string;
  selfRating: number | null;
  managerRating: number | null;
  /** The manager's rating before they saw the self-review, when it differs. */
  managerInitialRating?: number | null;
  labels?: Record<number, string>;
  selfText?: ComparisonText[];
  managerText?: ComparisonText[];
}

type Answers = Record<string, unknown> | null | undefined;

interface BuildOptions {
  /** Hide the manager's side entirely (results not shared yet). */
  showManager?: boolean;
  /** The manager's snapshot of ratings taken at first reveal. */
  initialRatings?: Record<string, number> | null;
}

function str(answers: Answers, field: string | undefined): string | null {
  if (!answers || !field) return null;
  const value = answers[field];
  return typeof value === "string" && value.trim() ? value : null;
}

function num(answers: Answers, field: string | undefined): number | null {
  if (!answers || !field) return null;
  const value = answers[field];
  return typeof value === "number" ? value : null;
}

function textItems(questions: Question[], answers: Answers, audience: "self" | "manager"): ComparisonText[] {
  return questions
    .filter((q) => q.kind === "text" && q.fields[audience])
    .map((q) => ({ label: q.isResponse ? "Response to your comments" : q.label, value: str(answers, q.fields[audience]) }))
    .filter((t) => t.value);
}

/**
 * One row per rating question. Text answers attach to the section's only
 * rating row, or to a separate comments row when a section has several
 * ratings (values).
 */
export function buildComparisonRows(self: Answers, manager: Answers, options: BuildOptions = {}): ComparisonRow[] {
  const showManager = options.showManager ?? true;
  const initial = options.initialRatings ?? null;
  const mgr = showManager ? manager : null;
  const rows: ComparisonRow[] = [];

  for (const section of SECTIONS) {
    const ratingQuestions = section.questions.filter((q) => q.kind === "rating");
    const textQuestions = section.questions.filter((q) => q.kind === "text");
    const selfText = textItems(textQuestions, self, "self");
    const managerText = showManager ? textItems(textQuestions, mgr, "manager") : [];

    if (ratingQuestions.length === 0) {
      if (selfText.length > 0 || managerText.length > 0) {
        rows.push({
          id: section.id,
          sectionId: section.id,
          sectionTitle: section.title,
          label: section.title,
          selfRating: null,
          managerRating: null,
          selfText,
          managerText,
        });
      }
      continue;
    }

    ratingQuestions.forEach((q, index) => {
      const managerField = q.fields.manager;
      const managerRating = num(mgr, managerField);
      const initialRating = managerField && initial && managerField in initial ? initial[managerField] : null;
      const attachText = ratingQuestions.length === 1 && index === 0;
      rows.push({
        id: q.id,
        sectionId: section.id,
        sectionTitle: section.title,
        label: q.label,
        selfRating: num(self, q.fields.self),
        managerRating,
        managerInitialRating: showManager && initialRating !== null && initialRating !== managerRating ? initialRating : undefined,
        labels: q.labels,
        selfText: attachText ? selfText : undefined,
        managerText: attachText ? managerText : undefined,
      });
    });

    if (ratingQuestions.length > 1 && (selfText.length > 0 || managerText.length > 0)) {
      rows.push({
        id: `${section.id}.comments`,
        sectionId: section.id,
        sectionTitle: section.title,
        label: `${section.title} comments`,
        selfRating: null,
        managerRating: null,
        selfText,
        managerText,
      });
    }
  }

  return rows;
}
