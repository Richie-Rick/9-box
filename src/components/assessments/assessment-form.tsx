"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FormQuestion {
  /** The value key (database column). */
  id: string;
  title: string;
  description?: string;
  required?: boolean;
  render: (value: unknown, onChange: (val: unknown) => void) => React.ReactNode;
  /** Rendered above the question, for example the "what they said" panel. */
  before?: React.ReactNode;
}

export interface FormSection {
  id: string;
  title: string;
  intro?: string;
  questions: FormQuestion[];
  /** Rendered after the section's questions, for example goal updates. */
  footer?: React.ReactNode;
}

export type FormLayout = "steps" | "single";

interface AssessmentFormProps {
  sections: FormSection[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onSave: () => void;
  onSubmit: () => void;
  saving?: boolean;
  submitting?: boolean;
  isSubmitted?: boolean;
  /** When submitted but some questions stay editable (manager responses). */
  editableWhenSubmitted?: string[];
  error?: string | null;
  /** Content shown above the form in both layouts. */
  header?: React.ReactNode;
}

const LAYOUT_KEY = "assessment-layout";

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function useLayout(): [FormLayout, (l: FormLayout) => void] {
  const [layout, setLayoutState] = useState<FormLayout>("steps");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAYOUT_KEY);
      if (saved === "single" || saved === "steps") {
        // Deferred so the first render matches the server
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
  editableWhenSubmitted = [],
  error,
  header,
}: AssessmentFormProps) {
  const [layout, setLayout] = useLayout();
  const [currentStep, setCurrentStep] = useState(0);

  const flat = useMemo(
    () =>
      sections.flatMap((section) =>
        section.questions.map((question, indexInSection) => ({
          section,
          question,
          indexInSection,
          sectionCount: section.questions.length,
        }))
      ),
    [sections]
  );

  const required = flat.filter((f) => f.question.required);
  const answered = required.filter((f) => !isEmpty(values[f.question.id]));
  const missing = required
    .map((f, i) => ({ ...f, index: flat.indexOf(f), key: i }))
    .filter((f) => isEmpty(values[f.question.id]));
  const canSubmit = missing.length === 0 && !submitting && !isSubmitted;

  const safeStep = Math.min(currentStep, flat.length - 1);
  const current = flat[safeStep];
  const isLast = safeStep === flat.length - 1;
  const isFirst = safeStep === 0;

  function isLocked(questionId: string): boolean {
    return !!isSubmitted && !editableWhenSubmitted.includes(questionId);
  }

  function renderQuestion(question: FormQuestion, compact = false) {
    const locked = isLocked(question.id);
    return (
      <div className={cn(compact && "py-4 first:pt-0 last:pb-0")}>
        {question.before}
        <h3 className={cn("font-semibold text-visory-navy mb-1", compact ? "text-base" : "text-xl")}>
          {question.title}
          {question.required && <span className="text-visory ml-1" title="Required">*</span>}
        </h3>
        {question.description && <p className="text-sm text-gray-500 mb-4">{question.description}</p>}
        <div className={cn("mt-3", locked && "opacity-70 pointer-events-none")}>
          {question.render(values[question.id], (val) => onChange(question.id, val))}
        </div>
      </div>
    );
  }

  const layoutToggle = (
    <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
      <button
        type="button"
        onClick={() => setLayout("steps")}
        className={cn("px-3 py-1.5", layout === "steps" ? "bg-visory-navy text-white" : "bg-white text-visory-navy hover:bg-gray-50")}
      >
        One at a time
      </button>
      <button
        type="button"
        onClick={() => setLayout("single")}
        className={cn("px-3 py-1.5", layout === "single" ? "bg-visory-navy text-white" : "bg-white text-visory-navy hover:bg-gray-50")}
      >
        All on one page
      </button>
    </div>
  );

  const progressText = `${answered.length} of ${required.length} required answered`;

  const missingNotice = missing.length > 0 && !isSubmitted && (
    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
      <p className="font-medium mb-1">
        {missing.length} rating{missing.length === 1 ? "" : "s"} still needed before you can submit:
      </p>
      <ul className="flex flex-wrap gap-2">
        {missing.map((m) => (
          <li key={m.question.id}>
            <button
              type="button"
              onClick={() => {
                if (layout === "steps") setCurrentStep(m.index);
                else document.getElementById(`q-${m.question.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="underline underline-offset-2 hover:text-amber-900"
            >
              {m.question.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const errorNotice = error && (
    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">
      {error}
    </div>
  );

  const actions = (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={onSave} disabled={saving || (isSubmitted && editableWhenSubmitted.length === 0)}>
        {saving ? "Saving..." : isSubmitted ? "Save responses" : "Save Draft"}
      </Button>
      <Button onClick={onSubmit} disabled={!canSubmit} title={missing.length > 0 ? `${missing.length} required rating(s) missing` : undefined}>
        {isSubmitted ? "Submitted" : submitting ? "Submitting..." : "Submit"}
      </Button>
    </div>
  );

  if (layout === "single") {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <p className="text-xs text-gray-500">{progressText}</p>
          {layoutToggle}
        </div>
        {header}
        <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-6">
          <nav className="hidden lg:block sticky top-24 self-start">
            <ul className="space-y-1">
              {sections.map((s) => {
                const req = s.questions.filter((q) => q.required);
                const done = req.filter((q) => !isEmpty(values[q.id])).length;
                return (
                  <li key={s.id}>
                    <a href={`#s-${s.id}`} className="flex items-center justify-between text-sm text-visory-navy hover:text-visory px-2 py-1 rounded hover:bg-gray-100">
                      <span>{s.title}</span>
                      {req.length > 0 && (
                        <span className={cn("text-xs", done === req.length ? "text-green-600" : "text-gray-400")}>
                          {done}/{req.length}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="space-y-6 pb-28">
            {sections.map((section) => (
              <section key={section.id} id={`s-${section.id}`} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 scroll-mt-24">
                <h2 className="text-lg font-semibold text-visory-navy">{section.title}</h2>
                {section.intro && <p className="text-sm text-gray-500 mb-2">{section.intro}</p>}
                <div className="divide-y divide-gray-100">
                  {section.questions.map((q) => (
                    <div key={q.id} id={`q-${q.id}`}>{renderQuestion(q, true)}</div>
                  ))}
                </div>
                {section.footer && <div className="mt-4 pt-4 border-t border-gray-100">{section.footer}</div>}
              </section>
            ))}
            {missingNotice}
            {errorNotice}
          </div>
        </div>
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-gray-200 py-3 px-4 z-40">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">{progressText}</p>
            {actions}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-xs text-gray-500">{progressText}</p>
        {layoutToggle}
      </div>
      {header}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>
            {current.section.title} · question {current.indexInSection + 1} of {current.sectionCount}
          </span>
          <span>Step {safeStep + 1} of {flat.length}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-visory rounded-full transition-all duration-300"
            style={{ width: `${((safeStep + 1) / flat.length) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentStep(flat.findIndex((f) => f.section.id === s.id))}
              className={cn(
                "text-xs px-2 py-0.5 rounded-full border",
                s.id === current.section.id ? "bg-visory-navy text-white border-visory-navy" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 min-h-[300px]">
        {current.section.intro && current.indexInSection === 0 && (
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">{current.section.intro}</p>
        )}
        {renderQuestion(current.question)}
        {current.indexInSection === current.sectionCount - 1 && current.section.footer && (
          <div className="mt-6 pt-4 border-t border-gray-100">{current.section.footer}</div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {errorNotice}
        {isLast && missingNotice}
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={() => setCurrentStep((s) => s - 1)} disabled={isFirst}>
          Back
        </Button>
        {isLast ? (
          actions
        ) : (
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onSave} disabled={saving || (isSubmitted && editableWhenSubmitted.length === 0)}>
              {saving ? "Saving..." : isSubmitted ? "Save responses" : "Save Draft"}
            </Button>
            <Button onClick={() => setCurrentStep((s) => s + 1)}>Next</Button>
          </div>
        )}
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
                ? "border-visory bg-visory-light text-visory-dark font-semibold"
                : "border-gray-200 hover:border-gray-300 text-visory-navy"
            )}
          >
            <span className="text-2xl font-bold block">{rating}</span>
            <span className="text-sm">{displayLabels[rating]}</span>
          </button>
        ))}
      </div>
      {prompts && prompts.length > 0 && (
        <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Consider</p>
          <ul className="space-y-1">
            {prompts.map((p, i) => (
              <li key={i} className="text-sm text-gray-600 flex gap-2">
                <span className="text-gray-400 shrink-0">&#8226;</span>
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
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory focus:border-visory transition-colors"
    />
  );
}
