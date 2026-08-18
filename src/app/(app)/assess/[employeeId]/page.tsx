"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { StepForm, TextStep, MultiRatingStep, RatingWithComment, type StepConfig } from "@/components/assessments/step-form";
import { assessmentPrompts } from "@/lib/assessment-prompts";
import { GoalsPanel } from "@/components/assessments/goals-panel";
import { ActionsEditor } from "@/components/meetings/actions-editor";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default function ManagerAssessPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const cycleId = searchParams.get("cycleId");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resultsSent, setResultsSent] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [editing, setEditing] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  // Whether every key metric has a saved actual result (gates step 1).
  const [metricsComplete, setMetricsComplete] = useState(true);

  useEffect(() => {
    if (!cycleId) return;
    fetch(`/api/assessments/manager?cycleId=${cycleId}&employeeId=${employeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.length > 0) {
          const a = data[0];
          setAssessmentId(a.id);
          setIsSubmitted(!!a.submittedAt);
          setResultsSent(!!a.resultsSentAt);
          setUnlocked(!!a.unlockedAt);
          setEmployeeName(a.employee?.name || "");
          setValues({
            performance: a.performance,
            performanceEvidence: a.performanceEvidence || "",
            growthReadiness: a.growthReadiness,
            growthReadinessEvidence: a.growthReadinessEvidence || "",
            valCustomerFirst: a.valCustomerFirst,
            valStepIntoArena: a.valStepIntoArena,
            valFlockToProblems: a.valFlockToProblems,
            valGiveEnergy: a.valGiveEnergy,
            valuesEvidence: a.valuesEvidence || "",
            engagement: a.engagement,
            engagementEvidence: a.engagementEvidence || "",
            notes: a.notes || "",
          });
        }
      });
  }, [cycleId, employeeId]);

  const save = useCallback(async (submit = false) => {
    if (!cycleId) return;
    const body = { cycleId, employeeId, ...values };
    if (submit) {
      (body as Record<string, unknown>).submittedAt = new Date().toISOString();
    }

    if (submit) setSubmitting(true);
    else setSaving(true);

    try {
      const res = await fetch("/api/assessments/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
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
  }, [cycleId, employeeId, values]);

  // Re-opening a shared review keeps it visible to the employee — only an
  // explicit withdraw takes it back.
  const unlockAndEdit = useCallback(async () => {
    if (!assessmentId) return;
    setUnlocking(true);
    try {
      const res = await fetch("/api/assessments/manager/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });
      if (res.ok) {
        setUnlocked(true);
        setEditing(true);
      }
    } finally {
      setUnlocking(false);
      setConfirmUnlock(false);
    }
  }, [assessmentId]);

  const withdrawResults = useCallback(async () => {
    if (!assessmentId) return;
    setUnlocking(true);
    try {
      const res = await fetch("/api/assessments/manager/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, withdraw: true }),
      });
      if (res.ok) {
        setResultsSent(false);
        setUnlocked(false);
        setEditing(true);
      }
    } finally {
      setUnlocking(false);
      setConfirmWithdraw(false);
    }
  }, [assessmentId]);

  // Locked once results are sent, or after submit until the manager re-opens
  // it for editing. While locked the form is read-only and never gates Next.
  const locked = (resultsSent && !unlocked) || (isSubmitted && !editing);

  const steps: StepConfig[] = [
    {
      id: "performance",
      title: `Performance Rating${employeeName ? ` for ${employeeName}` : ""}`,
      description: "Rate this employee's performance against objectives.",
      renderMulti: (vals, onChange) => (
        <RatingWithComment
          values={vals}
          onChange={onChange}
          ratingId="performance"
          commentId="performanceEvidence"
          prompts={assessmentPrompts.performance?.manager}
          commentPlaceholder="Describe specific examples of performance..."
        />
      ),
      // Block advancing past Performance Rating until every key metric has a
      // saved actual result — it's the second most important thing to complete.
      blockNext: !locked && !metricsComplete,
      blockNextHint: "Record an actual result for each key metric to continue.",
      footer: (
        <>
          <GoalsPanel
            employeeId={employeeId}
            cycleId={cycleId}
            editable={!locked}
            onMetricsStatus={({ total, complete }) => setMetricsComplete(total === 0 || complete >= total)}
          />
          <ActionsEditor
            employeeId={employeeId}
            readOnly
            assigneeOptions={[{ id: employeeId, name: employeeName || "Employee" }]}
          />
        </>
      ),
    },
    {
      id: "growthReadiness",
      title: "Growth Readiness Rating",
      description: "Rate this employee's readiness for growth and advancement.",
      renderMulti: (vals, onChange) => (
        <RatingWithComment
          values={vals}
          onChange={onChange}
          ratingId="growthReadiness"
          commentId="growthReadinessEvidence"
          labels={{ 1: "Developing", 2: "Building", 3: "Ready Now" }}
          prompts={assessmentPrompts.growthReadiness?.manager}
          commentPlaceholder="Describe growth indicators, learning agility..."
        />
      ),
    },
    {
      id: "values",
      title: "Values Alignment",
      description: "Rate this employee against each value, then add overall comments for the section.",
      renderMulti: (vals, onChange) => (
        <MultiRatingStep
          values={vals}
          onChange={onChange}
          commentId="valuesEvidence"
          commentLabel="Values Evidence"
          commentPlaceholder="Examples of values-aligned behaviour..."
          items={[
            { id: "valCustomerFirst", label: "Customer First", prompts: assessmentPrompts.valCustomerFirst?.manager },
            { id: "valStepIntoArena", label: "Step Into the Arena", prompts: assessmentPrompts.valStepIntoArena?.manager },
            { id: "valFlockToProblems", label: "Flock to Problems", prompts: assessmentPrompts.valFlockToProblems?.manager },
            { id: "valGiveEnergy", label: "Give Energy", prompts: assessmentPrompts.valGiveEnergy?.manager },
          ]}
        />
      ),
    },
    {
      id: "engagement",
      title: "Engagement Rating",
      description: "How engaged does this employee appear?",
      renderMulti: (vals, onChange) => (
        <RatingWithComment
          values={vals}
          onChange={onChange}
          ratingId="engagement"
          commentId="engagementEvidence"
          prompts={assessmentPrompts.engagement?.manager}
          commentPlaceholder="Observable behaviours that support this rating..."
        />
      ),
    },
    {
      id: "notes",
      title: "Additional Notes",
      description: "Any other observations or feedback for this employee.",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Additional context, action items..." />,
    },
  ];

  if (!cycleId) {
    return (
      <div className="text-center py-12 text-ink-3">
        No cycle selected. Go to your dashboard to start assessments.
      </div>
    );
  }

  return (
    <div className="py-4">
      <PageHeader
        eyebrow="Manager assessment"
        title={<>Assess <em>{employeeName || "report"}.</em></>}
        sub={employeeName ? `Rate ${employeeName} across performance, growth, values and engagement.` : undefined}
      />
      {resultsSent && unlocked ? (
        <div className="max-w-2xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-paper-2 border border-amber/40 p-4">
          <p className="text-sm text-ink-2">
            You are editing a review {employeeName || "this employee"} can already see. Your changes
            are visible to them as you save, and are recorded in the audit log. Send results again
            to confirm the update, or withdraw them to take the review back.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            disabled={unlocking}
            onClick={() => setConfirmWithdraw(true)}
          >
            Withdraw results
          </Button>
        </div>
      ) : resultsSent ? (
        <div className="max-w-2xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-paper-2 border border-line p-4">
          <p className="text-sm text-ink-2">
            Results have been sent and {employeeName || "the employee"} can see this review. Unlock
            to edit it — the review stays visible to them throughout, and changes are recorded in
            the audit log.
          </p>
          <Button
            size="sm"
            variant="magenta"
            className="shrink-0"
            disabled={unlocking}
            onClick={() => setConfirmUnlock(true)}
          >
            {unlocking ? "Unlocking..." : "Unlock & edit"}
          </Button>
        </div>
      ) : isSubmitted && !editing ? (
        <div className="max-w-2xl mx-auto mb-6 flex items-center justify-between gap-3 rounded-lg bg-paper-2 border border-amber/40 p-4">
          <p className="text-sm text-ink-2">
            This assessment has been submitted. You can edit it until results are sent — changes are recorded in the audit log.
          </p>
          <Button size="sm" variant="magenta" className="shrink-0" onClick={() => setEditing(true)}>
            Edit assessment
          </Button>
        </div>
      ) : null}

      <StepForm
        steps={steps}
        values={values}
        onChange={(key, val) => setValues((v) => ({ ...v, [key]: val }))}
        onSave={() => save(false)}
        onSubmit={() => save(true)}
        saving={saving}
        submitting={submitting}
        isSubmitted={locked}
        disabled={locked}
      />

      {confirmUnlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50">
          <div className="bg-paper border border-line rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="eyebrow mb-1">Confirm</div>
            <h3 className="serif text-xl text-ink mb-3">Unlock this review for editing?</h3>
            <p className="text-sm text-ink-2 mb-4">
              {employeeName || "The employee"} can already see this review and will keep seeing it,
              including any edits you make. Every change is recorded in the audit log. If you want to
              take the review back instead, withdraw the results.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setConfirmUnlock(false)}>Cancel</Button>
              <Button size="sm" variant="magenta" disabled={unlocking} onClick={unlockAndEdit}>
                {unlocking ? "Unlocking..." : "Unlock & edit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50">
          <div className="bg-paper border border-line rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="eyebrow mb-1">Confirm</div>
            <h3 className="serif text-xl text-ink mb-3">Withdraw results?</h3>
            <p className="text-sm text-ink-2 mb-4">
              {employeeName || "The employee"} will immediately lose access to this review, including
              their ratings, your evidence and your notes. You can send results again once you are
              ready.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setConfirmWithdraw(false)}>Cancel</Button>
              <Button size="sm" variant="magenta" disabled={unlocking} onClick={withdrawResults}>
                {unlocking ? "Withdrawing..." : "Withdraw results"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
