"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AssessmentForm, buildFormSections, initialValues, type FormSection } from "@/components/assessments/assessment-form";
import { formatCyclePeriod } from "@/lib/utils";
import { GoalsPanel } from "@/components/assessments/goals-panel";
import { ActionsEditor } from "@/components/meetings/actions-editor";
import { SelfGoalsEditor } from "@/components/assessments/self-goals-editor";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default function SelfAssessmentPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const cycleId = searchParams.get("cycleId");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Last cycle's stated goals, shown read-only as context for this one.
  const [previous, setPrevious] = useState<{
    quarter: number | null;
    month: number | null;
    year: number;
    goalsNextMonth: string;
  } | null>(null);

  useEffect(() => {
    if (!cycleId) return;
    fetch(`/api/assessments/self?cycleId=${cycleId}&prefill=true`)
      .then((r) => r.json())
      .then((data) => {
        if (data.length > 0) {
          const a = data[0];
          setAssessmentId(a.id);
          setIsSubmitted(!!a.submittedAt);
          setValues(initialValues("self", a));
          setPrevious(a._previous ?? null);
        }
      });
  }, [cycleId]);

  const save = useCallback(async (submit = false) => {
    if (!cycleId) return;
    const body = { cycleId, ...values };
    if (submit) {
      (body as Record<string, unknown>).submittedAt = new Date().toISOString();
    }

    if (submit) setSubmitting(true);
    else setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/assessments/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Failed to ${submit ? "submit" : "save"} (${res.status})`);
        return;
      }
      setAssessmentId(data.id);
      if (submit) {
        setIsSubmitted(true);
        setEditing(false);
        // Always return to the dashboard after submitting.
        router.push("/dashboard");
      }
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }, [cycleId, values]);

  // Re-open a submitted self-assessment for editing via the unlock endpoint.
  const unlock = useCallback(async () => {
    if (!assessmentId) return;
    const res = await fetch("/api/assessments/self/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId }),
    });
    if (res.ok) setEditing(true);
  }, [assessmentId]);

  // Locked after submit until the employee re-opens it for editing. While
  // locked the form is read-only.
  const locked = isSubmitted && !editing;
  const userId = session?.user?.id;

  const sections: FormSection[] = buildFormSections("self", "").map((section) => {
    if (section.id === "performance" && userId) {
      // Mirror what the manager sees under their Performance section: the
      // goals & key-metrics panel plus the tasks/actions list. (No review
      // notes — those stay manager-only, as on the manager flow.)
      return {
        ...section,
        footer: (
          <>
            <GoalsPanel employeeId={userId} cycleId={cycleId} editable={!locked} showGoalNotes={false} />
            <ActionsEditor
              employeeId={userId}
              readOnly
              assigneeOptions={[{ id: userId, name: session?.user?.name || "You" }]}
            />
          </>
        ),
      };
    }
    if (section.id === "ahead" && userId) {
      return {
        ...section,
        intro: "Add each goal individually. They are saved to your profile and tracked over time.",
        footer: (
          <>
            {previous && (
              <div className="rounded-lg bg-paper-2 border border-line p-4">
                <p className="eyebrow mb-1">What you set out to do in {formatCyclePeriod(previous)}</p>
                <p className="text-sm text-ink-2 whitespace-pre-wrap">{previous.goalsNextMonth}</p>
              </div>
            )}
            <SelfGoalsEditor employeeId={userId} />
          </>
        ),
      };
    }
    return section;
  });

  if (!cycleId) {
    return (
      <div className="text-center py-12 text-ink-3">
        No cycle selected. Go to your dashboard to start an assessment.
      </div>
    );
  }

  return (
    <div className="py-4">
      <PageHeader
        eyebrow="Self-Assessment"
        title={<>Your <em>reflection.</em></>}
        sub="Take your time. Save a draft whenever you like; your manager only sees it once you submit."
      />
      {isSubmitted && !editing && (
        <div className="max-w-2xl mx-auto mb-6 flex items-center justify-between gap-3 rounded-lg bg-paper-2 border border-amber/40 p-4">
          <p className="text-sm text-ink-2">
            This assessment has been submitted. You can re-open it to edit — changes are recorded in the audit log.
          </p>
          <Button size="sm" variant="magenta" className="shrink-0" disabled={!assessmentId} onClick={unlock}>
            Edit assessment
          </Button>
        </div>
      )}
      <AssessmentForm
        sections={sections}
        values={values}
        onChange={(key, val) => setValues((v) => ({ ...v, [key]: val }))}
        onSave={() => save(false)}
        onSubmit={() => save(true)}
        saving={saving}
        submitting={submitting}
        isSubmitted={locked}
        disabled={locked}
        error={error}
      />
    </div>
  );
}
