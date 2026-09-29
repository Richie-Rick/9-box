"use client";

import { useEffect, useState, useCallback, useMemo, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AssessmentForm, RatingInput, TextInput, type FormSection } from "@/components/assessments/assessment-form";
import { RevealPanel, type RevealState } from "@/components/assessments/reveal-panel";
import { GoalsMetricsCard } from "@/components/goals/goals-metrics-card";
import { GoalUpdatesEditor } from "@/components/goals/goal-updates-editor";
import { SECTIONS, withName, fieldsFor, sectionRatingFields } from "@/lib/assessment-sections";
import { MANAGER_RESPONSE_FIELDS } from "@/lib/assessment-fields";

const MANAGER_FIELDS = fieldsFor("manager");
const ALL_MANAGER_FIELDS = [...MANAGER_FIELDS.rating, ...MANAGER_FIELDS.text];

function pickValues(record: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of MANAGER_FIELDS.rating) values[field] = record[field] ?? null;
  for (const field of MANAGER_FIELDS.text) values[field] = (record[field] as string | null) ?? "";
  return values;
}

export default function ManagerAssessPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const cycleId = searchParams.get("cycleId");

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, RevealState>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});
  const [revealErrors, setRevealErrors] = useState<Record<string, string>>({});

  const fetchReveal = useCallback(
    async (sectionId: string) => {
      const res = await fetch(`/api/assessments/self-for-review?cycleId=${cycleId}&employeeId=${employeeId}&section=${sectionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reveal");
      setRevealed((r) => ({ ...r, [sectionId]: { submitted: !!data.submitted, answers: data.answers ?? null } }));
    },
    [cycleId, employeeId]
  );

  useEffect(() => {
    if (!cycleId) return;
    fetch(`/api/assessments/manager?cycleId=${cycleId}&employeeId=${employeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const a = data[0] as Record<string, unknown>;
          setIsSubmitted(!!a.submittedAt);
          setEmployeeName((a.employee as { name?: string } | undefined)?.name || "");
          setValues(pickValues(a));
          // Sections already revealed earlier come back open
          const initial = (a.initialRatings as Record<string, number> | null) ?? {};
          for (const section of SECTIONS) {
            const fields = sectionRatingFields(section.id, "manager");
            if (fields.length > 0 && fields.every((f) => f in initial)) {
              fetchReveal(section.id).catch(() => {});
            }
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [cycleId, employeeId, fetchReveal]);

  const save = useCallback(
    async (submit = false): Promise<boolean> => {
      if (!cycleId) return false;
      const payload: Record<string, unknown> = { cycleId, employeeId, submit };
      for (const field of ALL_MANAGER_FIELDS) payload[field] = values[field] ?? null;

      if (submit) setSubmitting(true);
      else setSaving(true);
      setError(null);

      try {
        const res = await fetch("/api/assessments/manager", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not save. Please try again.");
          return false;
        }
        if (submit) {
          setIsSubmitted(true);
          if (data.bothComplete) {
            router.push(`/summary/${employeeId}?cycleId=${cycleId}`);
          }
        }
        return true;
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
        return false;
      } finally {
        setSaving(false);
        setSubmitting(false);
      }
    },
    [cycleId, employeeId, values, router]
  );

  const reveal = useCallback(
    async (sectionId: string) => {
      setRevealing((r) => ({ ...r, [sectionId]: true }));
      setRevealErrors((e) => ({ ...e, [sectionId]: "" }));
      try {
        // Ratings must be saved before the server will reveal
        const saved = isSubmitted ? true : await save(false);
        if (!saved) return;
        await fetchReveal(sectionId);
      } catch (err) {
        setRevealErrors((e) => ({ ...e, [sectionId]: (err as Error).message }));
      } finally {
        setRevealing((r) => ({ ...r, [sectionId]: false }));
      }
    },
    [save, fetchReveal, isSubmitted]
  );

  const sections: FormSection[] = useMemo(() => {
    return SECTIONS.map((section) => {
      const ratingFields = sectionRatingFields(section.id, "manager");
      const canReveal = ratingFields.length > 0 && ratingFields.every((f) => values[f] !== null && values[f] !== undefined);
      return {
        id: section.id,
        title: section.title,
        intro: section.intro,
        questions: section.questions
          .filter((q) => q.fields.manager)
          .map((q) => {
            const field = q.fields.manager!;
            return {
              id: field,
              title: withName(q.titles.manager, employeeName),
              description: withName(q.descriptions?.manager, employeeName),
              required: q.required,
              before: q.isResponse ? (
                <RevealPanel
                  employeeName={employeeName}
                  section={section}
                  state={revealed[section.id] ?? null}
                  canReveal={canReveal}
                  busy={!!revealing[section.id]}
                  error={revealErrors[section.id]}
                  onReveal={() => reveal(section.id)}
                />
              ) : undefined,
              render:
                q.kind === "rating"
                  ? (val, onChange) => (
                      <RatingInput
                        value={val as number | null}
                        onChange={onChange as (v: number) => void}
                        labels={q.labels}
                        prompts={q.prompts?.manager}
                      />
                    )
                  : (val, onChange) => (
                      <TextInput
                        value={val as string}
                        onChange={onChange as (v: string) => void}
                        placeholder={withName(q.placeholders?.manager, employeeName)}
                      />
                    ),
            };
          }),
        footer:
          section.id === "ahead" && cycleId && session?.user?.id ? (
            <GoalUpdatesEditor employeeId={employeeId} cycleId={cycleId} authorId={session.user.id} />
          ) : undefined,
      };
    });
  }, [employeeName, values, revealed, revealing, revealErrors, reveal, cycleId, employeeId, session?.user?.id]);

  if (!cycleId) {
    return (
      <div className="text-center py-12 text-gray-500">
        No cycle selected. Go to your dashboard to start assessments.
      </div>
    );
  }

  if (!loaded) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div className="py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-visory-navy">Manager Assessment</h1>
        {employeeName && <p className="text-sm text-gray-600 mt-1">Assessing: {employeeName}</p>}
        {isSubmitted && (
          <p className="text-xs text-gray-500 mt-1">
            Submitted. Ratings are locked; you can still reveal each section and add your responses.
          </p>
        )}
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
        editableWhenSubmitted={[...MANAGER_RESPONSE_FIELDS]}
        error={error}
        header={
          <div className="mb-6">
            <GoalsMetricsCard employeeId={employeeId} cycleId={cycleId} canEdit variant="form" />
          </div>
        }
      />
    </div>
  );
}
