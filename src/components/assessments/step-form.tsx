"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StepConfig {
  id: string;
  title: string;
  description?: string;
  // Single-field step: receives this step's value and a setter for its own id.
  render?: (
    value: unknown,
    onChange: (val: unknown) => void
  ) => React.ReactNode;
  // Multi-field step (e.g. several ratings + one comment in a single step):
  // receives the whole values map and a (key, value) setter.
  renderMulti?: (
    values: Record<string, unknown>,
    onChange: (key: string, val: unknown) => void
  ) => React.ReactNode;
  // Extra content rendered beneath this step's input (e.g. supporting panels
  // that belong to the step but aren't part of its value).
  footer?: React.ReactNode;
  // When true, the user cannot advance past this step (Next is disabled).
  blockNext?: boolean;
  // Hint shown next to a blocked Next button explaining what's required.
  blockNextHint?: string;
}

interface StepFormProps {
  steps: StepConfig[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onSave: () => void;
  onSubmit: () => void;
  saving?: boolean;
  submitting?: boolean;
  isSubmitted?: boolean;
  // When true the step's inputs are actually disabled (not just the footer
  // buttons) — used while a submitted assessment is locked for editing.
  disabled?: boolean;
}

export function StepForm({
  steps,
  values,
  onChange,
  onSave,
  onSubmit,
  saving,
  submitting,
  isSubmitted,
  disabled,
}: StepFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-1">
          <span className="eyebrow">Step <span className="mono tnum">{currentStep + 1}</span> of <span className="mono tnum">{steps.length}</span></span>
          <span className="mono tnum text-xs text-ink-3">{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-paper-2 rounded-full overflow-hidden border border-line">
          <div
            className="h-full bg-magenta rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="card p-6 sm:p-8 min-h-[300px]">
        <h2 className="serif text-2xl text-ink mb-1">{step.title}</h2>
        {step.description && (
          <p className="text-sm text-ink-3 mb-6">{step.description}</p>
        )}
        <fieldset
          disabled={disabled}
          className={cn("mt-4 min-w-0", disabled && "opacity-70")}
        >
          {step.renderMulti
            ? step.renderMulti(values, onChange)
            : step.render?.(values[step.id], (val) => onChange(step.id, val))}
        </fieldset>
        {step.footer && (
          <div className="mt-6 pt-6 border-t border-line space-y-6">{step.footer}</div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={isFirst}
        >
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onSave} disabled={saving || isSubmitted}>
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          {isLast ? (
            <Button onClick={onSubmit} disabled={submitting || isSubmitted}>
              {isSubmitted ? "Submitted" : submitting ? "Submitting..." : "Submit"}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              {step.blockNext && step.blockNextHint && (
                <span className="text-xs text-ink-3 max-w-[16rem] text-right">{step.blockNextHint}</span>
              )}
              <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={step.blockNext}>
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RatingStepProps {
  value: number | null;
  onChange: (val: number) => void;
  labels?: Record<number, string>;
  prompts?: string[];
}

export function RatingStep({ value, onChange, labels, prompts }: RatingStepProps) {
  const defaultLabels: Record<number, string> = {
    1: "Below",
    2: "Meeting",
    3: "Exceeding",
  };
  const displayLabels = labels || defaultLabels;

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

interface TextStepProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
}

export function TextStep({ value, onChange, placeholder, rows = 4 }: TextStepProps) {
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

interface MultiRatingItem {
  id: string;
  label: string;
  prompts?: string[];
}

interface MultiRatingStepProps {
  items: MultiRatingItem[];
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
  commentId: string;
  commentLabel?: string;
  commentPlaceholder?: string;
  labels?: Record<number, string>;
}

// Renders a single rating together with a free-text comments box beneath it,
// each bound to its own field in the shared values map. Lets a rating and its
// "general comments" live in one step instead of two.
export function RatingWithComment({
  values,
  onChange,
  ratingId,
  commentId,
  prompts,
  labels,
  commentLabel = "Comments",
  commentPlaceholder,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
  ratingId: string;
  commentId: string;
  prompts?: string[];
  labels?: Record<number, string>;
  commentLabel?: string;
  commentPlaceholder?: string;
}) {
  return (
    <div className="space-y-6">
      <RatingStep
        value={(values[ratingId] as number | null) ?? null}
        onChange={(v) => onChange(ratingId, v)}
        prompts={prompts}
        labels={labels}
      />
      <div>
        <p className="text-base font-semibold text-ink mb-3">{commentLabel}</p>
        <TextStep
          value={(values[commentId] as string) || ""}
          onChange={(v) => onChange(commentId, v)}
          placeholder={commentPlaceholder}
        />
      </div>
    </div>
  );
}

// Renders several ratings (one per value) plus a single shared comment box,
// all within one step.
export function MultiRatingStep({
  items,
  values,
  onChange,
  commentId,
  commentLabel = "Comments",
  commentPlaceholder,
  labels,
}: MultiRatingStepProps) {
  return (
    <div className="space-y-8">
      {items.map((item) => (
        <div key={item.id}>
          <p className="text-base font-semibold text-ink mb-3">{item.label}</p>
          <RatingStep
            value={(values[item.id] as number | null) ?? null}
            onChange={(v) => onChange(item.id, v)}
            labels={labels}
            prompts={item.prompts}
          />
        </div>
      ))}
      <div>
        <p className="text-base font-semibold text-ink mb-3">{commentLabel}</p>
        <TextStep
          value={(values[commentId] as string) || ""}
          onChange={(v) => onChange(commentId, v)}
          placeholder={commentPlaceholder}
        />
      </div>
    </div>
  );
}
