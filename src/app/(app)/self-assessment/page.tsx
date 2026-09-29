"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AssessmentForm, RatingInput, TextInput, type FormSection } from "@/components/assessments/assessment-form";
import { GoalsMetricsCard } from "@/components/goals/goals-metrics-card";
import { GoalUpdatesEditor } from "@/components/goals/goal-updates-editor";
import { SECTIONS, withName, fieldsFor } from "@/lib/assessment-sections";
import { formatCyclePeriod } from "@/lib/utils";

const SELF_FIELDS = fieldsFor("self");
const ALL_SELF_FIELDS = [...SELF_FIELDS.rating, ...SELF_FIELDS.text];

function pickValues(record: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of SELF_FIELDS.rating) values[field] = record[field] ?? null;
  for (const field of SELF_FIELDS.text) values[field] = (record[field] as string | null) ?? "";
  return values;
}

export default function SelfAssessmentPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const cycleId = searchParams.get("cycleId");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [previousGoals, setPreviousGoals] = useState<{ month: number; year: number; goalsNextMonth: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!cycleId) return;
    fetch(`/api/assessments/self?cycleId=${cycleId}&prefill=true`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const a = data[0] as Record<string, unknown>;
          setIsSubmitted(!!a.submittedAt);
          setSubmittedAt((a.submittedAt as string | null) ?? null);
          setValues(pickValues(a));
          if (a._previous) setPreviousGoals(a._previous as { month: number; year: number; goalsNextMonth: string });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [cycleId]);

  const save = useCallback(async (submit = false) => {
    if (!cycleId) return;
    const payload: Record<string, unknown> = { cycleId, submit };
    for (const field of ALL_SELF_FIELDS) payload[field] = values[field] ?? null;

    if (submit) setSubmitting(true);
    else setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/assessments/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save. Please try again.");
        return;
      }
      if (editing && !submit) setEditing(false);
      if (submit) {
        setIsSubmitted(true);
        setSubmittedAt(new Date().toISOString());
        if (data.bothComplete) {
          router.push(`/summary/${data.employeeId}?cycleId=${cycleId}`);
        }
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }, [cycleId, values, router, editing]);

  const userId = session?.user?.id;
  const userName = session?.user?.name ?? "";

  const sections: FormSection[] = useMemo(() => {
    return SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      intro: section.intro,
      questions: section.questions
        .filter((q) => q.fields.self)
        .map((q) => {
          const field = q.fields.self!;
          return {
            id: field,
            title: withName(q.titles.self, userName),
            description: withName(q.descriptions?.self, userName),
            required: q.required,
            render:
              q.kind === "rating"
                ? (val: unknown, onChange: (v: unknown) => void) => (
                    <RatingInput
                      value={val as number | null}
                      onChange={onChange as (v: number) => void}
                      labels={q.labels}
                      prompts={q.prompts?.self}
                    />
                  )
                : (val: unknown, onChange: (v: unknown) => void) => (
                    <TextInput
                      value={val as string}
                      onChange={onChange as (v: string) => void}
                      placeholder={q.placeholders?.self}
                    />
                  ),
          };
        }),
      footer:
        section.id === "ahead" && cycleId && userId ? (
          <GoalUpdatesEditor employeeId={userId} cycleId={cycleId} authorId={userId} disabled={isSubmitted} />
        ) : undefined,
    }));
  }, [cycleId, userId, userName, isSubmitted]);

  if (!cycleId) {
    return (
      <div className="text-center py-12 text-gray-500">
        No cycle selected. Go to your dashboard to start an assessment.
      </div>
    );
  }

  if (!loaded) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div className="py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-visory-navy">Self-Assessment</h1>
        <p className="text-sm text-gray-600 mt-1">
          Take your time. Save a draft whenever you like; your manager only sees it once you submit.
        </p>
      </div>
      <AssessmentForm
        sections={sections}
        values={values}
        onChange={(key, val) => setValues((v) => ({ ...v, [key]: val }))}
        onSave={() => save(false)}
        onSubmit={() => save(true)}
        saving={saving}
        submitting={submitting}
        isSubmitted={isSubmitted}
        error={error}
        editing={editing}
        onStartEditing={() => setEditing(true)}
        onCancelEditing={() => setEditing(false)}
        submittedAt={submittedAt}
        submittedNote="You can edit a section until your manager has read it."
        header={
          <div className="mb-6 space-y-4">
            {previousGoals && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs font-medium text-blue-700 uppercase mb-1">
                  Last month ({formatCyclePeriod(previousGoals.month, previousGoals.year)}) you said your goals for this month were
                </p>
                <p className="text-sm text-blue-900 whitespace-pre-wrap">{previousGoals.goalsNextMonth}</p>
              </div>
            )}
            {userId && <GoalsMetricsCard employeeId={userId} cycleId={cycleId} isSelf variant="form" />}
          </div>
        }
      />
    </div>
  );
}
