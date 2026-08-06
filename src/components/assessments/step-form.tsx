"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StepConfig {
  id: string;
  title: string;
  description?: string;
  render: (
    value: unknown,
    onChange: (val: unknown) => void
  ) => React.ReactNode;
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
  canEdit?: boolean;
  lastEditedAt?: string | null;
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
  canEdit,
  lastEditedAt,
}: StepFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;
  const readOnly = !!isSubmitted && !editing;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-visory rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 min-h-[300px]">
        <h2 className="text-xl font-semibold text-visory-navy mb-1">{step.title}</h2>
        {step.description && (
          <p className="text-sm text-gray-500 mb-6">{step.description}</p>
        )}
        <fieldset disabled={readOnly} className="mt-4">
          {step.render(values[step.id], (val) => onChange(step.id, val))}
        </fieldset>
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
          {readOnly ? (
            <>
              {canEdit ? (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              ) : (
                <span className="text-sm text-gray-500">Locked — results sent</span>
              )}
              {isLast ? (
                <Button disabled>Submitted</Button>
              ) : (
                <Button onClick={() => setCurrentStep((s) => s + 1)}>
                  Next
                </Button>
              )}
            </>
          ) : editing ? (
            <>
              {isLast ? (
                <Button onClick={onSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={onSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button onClick={() => setCurrentStep((s) => s + 1)}>
                    Next
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              {isLast ? (
                <Button onClick={onSubmit} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              ) : (
                <Button onClick={() => setCurrentStep((s) => s + 1)}>
                  Next
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {lastEditedAt && (
        <p className="text-xs text-gray-500 text-right mt-2">
          Last edited {new Date(lastEditedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}
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
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory focus:border-visory transition-colors"
    />
  );
}
