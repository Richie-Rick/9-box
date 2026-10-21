"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AssessmentForm, buildFormSections, initialValues, type FormSection } from "@/components/assessments/assessment-form";
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
  const [unlocking, setUnlocking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Whether every key metric has a saved actual result (gates section 1).
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
          setEmployeeName(a.employee?.name || "");
          setValues(initialValues("manager", a));
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
    setError(null);

    try {
      const res = await fetch("/api/assessments/manager", {
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
  }, [cycleId, employeeId, values]);

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
        setResultsSent(false);
        setEditing(true);
      }
    } finally {
      setUnlocking(false);
    }
  }, [assessmentId]);

  // Locked once results are sent, or after submit until the manager re-opens
  // it for editing. While locked the form is read-only and never gates Next.
  const locked = resultsSent || (isSubmitted && !editing);

  const sections: FormSection[] = buildFormSections("manager", employeeName).map((section) => {
    if (section.id !== "performance") return section;
    return {
      ...section,
      // Block advancing past Performance until every key metric has a saved
      // actual result — it's the second most important thing to complete.
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
    };
  });

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
      {resultsSent ? (
        <div className="max-w-2xl mx-auto mb-6 flex items-center justify-between gap-3 rounded-lg bg-paper-2 border border-line p-4">
          <p className="text-sm text-ink-2">
            Results have been sent to the employee. Unlock to edit this assessment — changes are recorded in the audit log, and you can re-send results afterward.
          </p>
          <Button
            size="sm"
            variant="magenta"
            className="shrink-0"
            disabled={unlocking}
            onClick={unlockAndEdit}
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
