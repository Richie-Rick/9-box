"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SECTIONS, withName, type Audience } from "@/lib/assessment-sections";

export interface FormQuestion {
  /** The value key (database column). */
  id: string;
  title: string;
  /** Short name used in the "still needed" list. Defaults to the title. */
  label?: string;
  description?: string;
  required?: boolean;
  render: (value: unknown, onChange: (val: unknown) => void) => React.ReactNode;
  /** Rendered above the question, e.g. the "what they said" panel. */
  before?: React.ReactNode;
}

export interface FormSection {
  id: string;
  title: string;
  intro?: string;
  questions: FormQuestion[];
  /** Rendered beneath the section's questions (e.g. goals & metrics panel). */
  footer?: React.ReactNode;
  /** When true, the user cannot advance past this section in step mode. */
  blockNext?: boolean;
  /** Explains what's required when blocked. Shown as a banner on one page. */
  blockNextHint?: string;
}

interface AssessmentFormProps {
  sections: FormSection[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onSave: () => void;
  onSubmit: () => void;
  saving?: boolean;
  submitting?: boolean;
  isSubmitted?: boolean;
  // When true the inputs are actually disabled (not just the footer
  // buttons) — used while a submitted assessment is locked for editing.
  disabled?: boolean;
  // Error returned by the last save/submit attempt, shown beneath the form.
  error?: string | null;
  // Question ids that stay editable while the form is locked (manager
  // responses after submission). Save stays available for them.
  editableWhenLocked?: string[];
}

export type FormLayout = "steps" | "single";

const LAYOUT_KEY = "assessment-layout";

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

// The layout preference lives in localStorage. It is read after mount (and
// deferred a tick) so the first client render matches the server's.
function useLayout(): [FormLayout, (l: FormLayout) => void] {
  const [layout, setLayoutState] = useState<FormLayout>("steps");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAYOUT_KEY);
      if (saved === "single" || saved === "steps") {
        const id = window.setTimeout(() => setLayoutState(saved), 0);
        return () => window.clearTimeout(id);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setLayout = (l: FormLayout) => {
    setLayoutState(l);
    try {
      window.localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* ignore */
    }
  };
  return [layout, setLayout];
}

export function AssessmentForm({
  sections,
  values,
  onChange,
  onSave,
  onSubmit,
  saving,
  submitting,
  isSubmitted,
  disabled,
  error,
  editableWhenLocked = [],
}: AssessmentFormProps) {
  const [layout, setLayout] = useLayout();
  const [currentStep, setCurrentStep] = useState(0);

  const safeStep = Math.min(currentStep, sections.length - 1);
  const section = sections[safeStep];
  const isLast = safeStep === sections.length - 1;
  const isFirst = safeStep === 0;

  const required = useMemo(
    () => sections.flatMap((s) => s.questions.filter((q) => q.required).map((q) => ({ section: s, question: q }))),
    [sections]
  );
  const missing = required.filter(({ question }) => isEmpty(values[question.id]));
  const answered = required.length - missing.length;
  const canSubmit = missing.length === 0 && !submitting && !isSubmitted;

  function requiredDone(s: FormSection) {
    const req = s.questions.filter((q) => q.required);
    return { done: req.filter((q) => !isEmpty(values[q.id])).length, total: req.length };
  }

  function jumpTo(sectionId: string, questionId?: string) {
    if (layout === "steps") {
      setCurrentStep(Math.max(0, sections.findIndex((s) => s.id === sectionId)));
    } else {
      document.getElementById(questionId ? `q-${questionId}` : `s-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const layoutToggle = (
    <div className="flex rounded-lg border border-line-2 overflow-hidden text-xs font-medium" role="group" aria-label="Form layout">
      <button
        type="button"
        onClick={() => setLayout("steps")}
        className={cn("px-3 py-1.5 transition-colors", layout === "steps" ? "bg-navy text-white" : "bg-paper text-ink-2 hover:bg-paper-2")}
      >
        One at a time
      </button>
      <button
        type="button"
        onClick={() => setLayout("single")}
        className={cn("px-3 py-1.5 transition-colors", layout === "single" ? "bg-navy text-white" : "bg-paper text-ink-2 hover:bg-paper-2")}
      >
        All on one page
      </button>
    </div>
  );

  const progressText = (
    <span className="text-xs text-ink-3">
      <span className="mono tnum">{answered}</span> of <span className="mono tnum">{required.length}</span> ratings answered
    </span>
  );

  const missingNotice = missing.length > 0 && !isSubmitted && (
    <div className="rounded-lg bg-paper-2 border border-amber/40 p-3 text-sm text-ink-2">
      <p className="font-medium text-ink mb-1">
        Still needed before you can submit:
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {missing.map(({ section: s, question: q }) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => jumpTo(s.id, q.id)}
              className="underline underline-offset-2 hover:text-magenta"
            >
              {q.label ?? q.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const errorNotice = error && (
    <div className="rounded-lg bg-magenta-3 border border-magenta/25 p-3 text-sm text-magenta-2" role="alert">
      {error}
    </div>
  );

  const canSaveLocked = editableWhenLocked.length > 0;
  const saveButton = (
    <Button variant="secondary" onClick={onSave} disabled={saving || (isSubmitted && !canSaveLocked)}>
      {saving ? "Saving..." : isSubmitted ? "Save responses" : "Save Draft"}
    </Button>
  );

  const submitButton = (
    <Button onClick={onSubmit} disabled={!canSubmit} title={missing.length > 0 ? `${missing.length} rating(s) still needed` : undefined}>
      {isSubmitted ? "Submitted" : submitting ? "Submitting..." : "Submit"}
    </Button>
  );

  function renderQuestion(q: FormQuestion, compact: boolean) {
    const locked = !!disabled && !editableWhenLocked.includes(q.id);
    return (
      <div id={`q-${q.id}`} className={cn("scroll-mt-24", compact ? "py-5 first:pt-0 last:pb-0" : "py-6 first:pt-0 last:pb-0")}>
        {q.before}
        <h3 className={cn("font-semibold text-ink mb-1", compact ? "text-base" : "text-lg")}>
          {q.title}
          {q.required && <span className="text-magenta ml-1" title="Required">*</span>}
        </h3>
        {q.description && <p className="text-sm text-ink-3 mb-3">{q.description}</p>}
        {/* One fieldset per question so responses can stay editable while the
            ratings are locked (a disabled ancestor would disable everything). */}
        <fieldset disabled={locked} className={cn("mt-3 min-w-0", locked && "opacity-70")}>
          {q.render(values[q.id], (val) => onChange(q.id, val))}
        </fieldset>
      </div>
    );
  }

  function renderSectionBody(s: FormSection, compact: boolean) {
    return (
      <>
        <div className="min-w-0 divide-y divide-line">
          {s.questions.map((q) => (
            <div key={q.id}>{renderQuestion(q, compact)}</div>
          ))}
        </div>
        {s.footer && (
          <div className={cn("space-y-6", s.questions.length > 0 && "mt-6 pt-6 border-t border-line")}>{s.footer}</div>
        )}
      </>
    );
  }

  if (layout === "single") {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          {progressText}
          {layoutToggle}
        </div>
        <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-6">
          <nav className="hidden lg:block sticky top-24 self-start" aria-label="Sections">
            <ul className="space-y-1">
              {sections.map((s) => {
                const { done, total } = requiredDone(s);
                return (
                  <li key={s.id}>
                    <a href={`#s-${s.id}`} className="flex items-center justify-between text-sm text-ink-2 hover:text-ink px-2 py-1 rounded hover:bg-paper-2">
                      <span>{s.title}</span>
                      {total > 0 && (
                        <span className={cn("mono tnum text-xs", done === total ? "text-success" : "text-ink-4")}>
                          {done}/{total}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="space-y-6 pb-28">
            {sections.map((s) => (
              <section key={s.id} id={`s-${s.id}`} className="card p-6 scroll-mt-24">
                <h2 className="serif text-2xl text-ink mb-1">{s.title}</h2>
                {s.intro && <p className="text-sm text-ink-3 mb-4">{s.intro}</p>}
                {s.blockNext && s.blockNextHint && (
                  <div className="rounded-lg bg-paper-2 border border-amber/40 p-3 mb-4 text-sm text-ink-2">{s.blockNextHint}</div>
                )}
                {renderSectionBody(s, true)}
              </section>
            ))}
            {missingNotice}
            {errorNotice}
          </div>
        </div>
        <div className="fixed bottom-0 inset-x-0 bg-paper/95 backdrop-blur border-t border-line py-3 px-4 z-40">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            {progressText}
            <div className="flex items-center gap-3">
              {saveButton}
              {submitButton}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        {progressText}
        {layoutToggle}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between mb-1">
          <span className="eyebrow">Section <span className="mono tnum">{safeStep + 1}</span> of <span className="mono tnum">{sections.length}</span></span>
          <span className="mono tnum text-xs text-ink-3">{Math.round(((safeStep + 1) / sections.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-paper-2 rounded-full overflow-hidden border border-line">
          <div
            className="h-full bg-magenta rounded-full transition-all duration-300"
            style={{ width: `${((safeStep + 1) / sections.length) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {sections.map((s, i) => {
            const { done, total } = requiredDone(s);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "chip cursor-pointer",
                  i === safeStep ? "chip-navy" : total > 0 && done === total ? "chip-success" : "chip-slate"
                )}
              >
                {s.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section content */}
      <div className="card p-6 sm:p-8 min-h-[300px]">
        <h2 className="serif text-2xl text-ink mb-1">{section.title}</h2>
        {section.intro && <p className="text-sm text-ink-3 mb-6">{section.intro}</p>}
        {renderSectionBody(section, false)}
      </div>

      <div className="mt-4 space-y-3">
        {errorNotice}
        {isLast && missingNotice}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={() => setCurrentStep((s) => s - 1)} disabled={isFirst}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          {saveButton}
          {isLast ? (
            submitButton
          ) : (
            <div className="flex items-center gap-3">
              {section.blockNext && section.blockNextHint && (
                <span className="text-xs text-ink-3 max-w-[16rem] text-right">{section.blockNextHint}</span>
              )}
              <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={section.blockNext}>
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RatingInputProps {
  value: number | null;
  onChange: (val: number) => void;
  labels?: Record<number, string>;
  prompts?: string[];
}

export function RatingInput({ value, onChange, labels, prompts }: RatingInputProps) {
  const displayLabels = labels || { 1: "Below", 2: "Meeting", 3: "Exceeding" };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3">
        {[1, 2, 3].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className={cn(
              "flex-1 p-4 rounded-lg border-2 text-center transition-all",
              value === rating
                ? "border-magenta bg-magenta-3 text-magenta-2"
                : "border-line hover:border-line-2 text-ink"
            )}
          >
            <span className="mono tnum text-2xl block">{rating}</span>
            <span className="text-sm">{displayLabels[rating]}</span>
          </button>
        ))}
      </div>
      {prompts && prompts.length > 0 && (
        <div className="mt-4 rounded-lg bg-paper-2 border border-line p-3">
          <p className="eyebrow mb-2">Consider</p>
          <ul className="space-y-1">
            {prompts.map((p, i) => (
              <li key={i} className="text-sm text-ink-2 flex gap-2">
                <span className="text-ink-4 shrink-0">&#8226;</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface TextInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
}

export function TextInput({ value, onChange, placeholder, rows = 4 }: TextInputProps) {
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta focus:border-magenta transition-colors"
    />
  );
}

/**
 * Builds the form sections for one side of the review from the shared
 * config. Pages attach footers and gates by section id afterwards.
 */
export function buildFormSections(audience: Audience, employeeName: string): FormSection[] {
  return SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    intro: section.intro,
    questions: section.questions
      .filter((q) => q.fields[audience] && !q.formHidden)
      .map((q) => ({
        id: q.fields[audience]!,
        title: withName(q.titles[audience], employeeName),
        label: q.label,
        description: withName(q.descriptions?.[audience], employeeName) || undefined,
        required: q.required,
        render:
          q.kind === "rating"
            ? (val: unknown, onChange: (v: unknown) => void) => (
                <RatingInput
                  value={(val as number | null) ?? null}
                  onChange={onChange as (v: number) => void}
                  labels={q.labels}
                  prompts={q.prompts?.[audience]}
                />
              )
            : (val: unknown, onChange: (v: unknown) => void) => (
                <TextInput
                  value={(val as string) || ""}
                  onChange={onChange as (v: string) => void}
                  placeholder={q.placeholders?.[audience]}
                />
              ),
      })),
  }));
}

/** Initial values map for one side: ratings null, text empty. */
export function initialValues(audience: Audience, record: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const section of SECTIONS) {
    for (const q of section.questions) {
      const field = q.fields[audience];
      if (!field) continue;
      values[field] = q.kind === "rating" ? (record[field] ?? null) : ((record[field] as string | null) ?? "");
    }
  }
  return values;
}
