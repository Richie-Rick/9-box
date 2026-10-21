"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AssessmentForm, buildFormSections, initialValues, type FormSection } from "@/components/assessments/assessment-form";
import { RevealPanel, type RevealState } from "@/components/assessments/reveal-panel";
import { GoalsPanel } from "@/components/assessments/goals-panel";
import { ActionsEditor } from "@/components/meetings/actions-editor";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SECTIONS, sectionRatingFields } from "@/lib/assessment-sections";
import { MANAGER_RESPONSE_FIELDS } from "@/lib/assessment-fields";
import { metricDisconnect } from "@/lib/nine-box";

const fieldClass =
  "w-full rounded-lg border border-line-2 bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-magenta focus:ring-2 focus:ring-magenta/20";

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
  const [sharedAt, setSharedAt] = useState<string | null>(null);
  const [resultsSent, setResultsSent] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Required once the review has been shared and a rating or comment changes.
  const [editReason, setEditReason] = useState("");
  // Whether every key metric has a saved actual result (gates section 1),
  // and how many were hit or missed (warns on the performance rating).
  const [metricsComplete, setMetricsComplete] = useState(true);
  const [metricOutcomes, setMetricOutcomes] = useState({ hit: 0, missed: 0 });
  // Self-assessment answers revealed per section (rate blind, then reveal).
  const [revealed, setRevealed] = useState<Record<string, RevealState>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});
  const [revealErrors, setRevealErrors] = useState<Record<string, string>>({});

  const fetchReveal = useCallback(
    async (sectionId: string) => {
      const res = await fetch(`/api/assessments/self-for-review?cycleId=${cycleId}&employeeId=${employeeId}&section=${sectionId}`);
      const data = await res.json().catch(() => ({}));
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
        if (data.length > 0) {
          const a = data[0];
          setAssessmentId(a.id);
          setIsSubmitted(!!a.submittedAt);
          setSharedAt(a.sharedAt ?? null);
          setResultsSent(!!a.resultsSentAt);
          setEmployeeName(a.employee?.name || "");
          setValues(initialValues("manager", a));
          // Sections revealed in an earlier visit come back open.
          const initial = (a.initialRatings as Record<string, number> | null) ?? {};
          for (const section of SECTIONS) {
            const fields = sectionRatingFields(section.id, "manager");
            if (fields.length > 0 && fields.every((f) => f in initial)) {
              fetchReveal(section.id).catch(() => {});
            }
          }
        }
      });
  }, [cycleId, employeeId, fetchReveal]);

  const save = useCallback(async (submit = false): Promise<boolean> => {
    if (!cycleId) return false;
    const body: Record<string, unknown> = { cycleId, employeeId, ...values };
    if (editReason.trim()) body.editReason = editReason.trim();
    if (submit) body.submittedAt = new Date().toISOString();

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
        return false;
      }
      setAssessmentId(data.id);
      if (submit) {
        setIsSubmitted(true);
        setEditing(false);
        // Always return to the dashboard after submitting.
        router.push("/dashboard");
      }
      return true;
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }, [cycleId, employeeId, values, editReason]);

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
  // it for editing. While locked the ratings and comments are read-only; the
  // manager's responses stay editable throughout.
  const locked = resultsSent || (isSubmitted && !editing);

  // Reveal a section's self-assessment: the ratings must be saved first so
  // the server can check them (and snapshot them) before it shows anything.
  const reveal = useCallback(
    async (sectionId: string) => {
      setRevealing((r) => ({ ...r, [sectionId]: true }));
      setRevealErrors((e) => ({ ...e, [sectionId]: "" }));
      try {
        if (!locked) {
          const ok = await save(false);
          if (!ok) throw new Error("Save your ratings first");
        }
        await fetchReveal(sectionId);
      } catch (err) {
        setRevealErrors((e) => ({ ...e, [sectionId]: (err as Error).message }));
      } finally {
        setRevealing((r) => ({ ...r, [sectionId]: false }));
      }
    },
    [save, fetchReveal, locked]
  );

  const sections: FormSection[] = buildFormSections("manager", employeeName).map((section) => {
    const config = SECTIONS.find((s) => s.id === section.id)!;
    const ratingFields = sectionRatingFields(section.id, "manager");
    const canReveal = ratingFields.length > 0 && ratingFields.every((f) => values[f] !== null && values[f] !== undefined);
    const state = revealed[section.id] ?? null;

    // The response question carries the reveal panel above it, and only
    // becomes a text box once the employee's answers are on screen.
    const questions = section.questions.map((q) => {
      if (!MANAGER_RESPONSE_FIELDS.includes(q.id)) return q;
      const render = state?.submitted
        ? q.render
        : () => (
            <p className="text-sm text-ink-3">
              {state ? "Nothing to respond to yet." : "Reveal what they said to write your response."}
            </p>
          );
      return {
        ...q,
        render,
        before: (
          <RevealPanel
            employeeName={employeeName}
            section={config}
            state={state}
            canReveal={canReveal}
            busy={!!revealing[section.id]}
            error={revealErrors[section.id]}
            onReveal={() => reveal(section.id)}
          />
        ),
      };
    });

    if (section.id !== "performance") return { ...section, questions };
    const performance = values.performance as number | null;
    const { disconnect } = metricDisconnect(performance, [
      ...Array(metricOutcomes.hit).fill({ achieved: true }),
      ...Array(metricOutcomes.missed).fill({ achieved: false }),
    ]);
    return {
      ...section,
      questions,
      notice: disconnect ? (
        <>
          <span className="font-medium text-ink">Rating vs results:</span> {employeeName || "this person"} missed more key
          metrics than they hit this cycle ({metricOutcomes.missed} missed, {metricOutcomes.hit} hit), but is rated{" "}
          {performance === 3 ? "Exceeding" : "Meeting"}. Check the evidence supports the rating, or whether the targets were the problem.
        </>
      ) : undefined,
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
            onMetricsStatus={({ total, complete, hit, missed }) => {
              setMetricsComplete(total === 0 || complete >= total);
              setMetricOutcomes({ hit, missed });
            }}
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

  const sharedLabel = sharedAt
    ? new Date(sharedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
    : null;

  return (
    <div className="py-4">
      <PageHeader
        eyebrow="Manager assessment"
        title={<>Assess <em>{employeeName || "report"}.</em></>}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {employeeName && <span>Rate {employeeName} across performance, growth, values and engagement.</span>}
            {sharedLabel && <Badge variant="navy">Shared {sharedLabel}</Badge>}
            {resultsSent && <Badge variant="success">Results sent</Badge>}
          </span>
        }
      />
      {resultsSent ? (
        <div className="max-w-2xl mx-auto mb-6 flex items-center justify-between gap-3 rounded-lg bg-paper-2 border border-line p-4">
          <p className="text-sm text-ink-2">
            Results have been sent to the employee. You can still add to your responses. Unlock to edit the ratings — changes are recorded in the audit log, and you can re-send results afterward.
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
            This assessment has been submitted. You can reveal each section and add your responses, or edit the ratings until results are sent — changes are recorded in the audit log.
          </p>
          <Button size="sm" variant="magenta" className="shrink-0" onClick={() => setEditing(true)}>
            Edit assessment
          </Button>
        </div>
      ) : null}

      {sharedAt && !locked && (
        <div className="max-w-2xl mx-auto mb-6 rounded-lg bg-paper-2 border border-navy/20 p-4">
          <p className="text-sm text-ink-2 mb-2">
            This review has been shared with {employeeName || "the employee"}. Changing a rating or comment needs a short reason, which is recorded in the audit log and shown to them as &ldquo;updated since shared&rdquo;.
          </p>
          <input
            type="text"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder="Reason for the change (e.g. new information from the 1:1)"
            maxLength={300}
            className={fieldClass}
          />
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
        editableWhenLocked={locked ? MANAGER_RESPONSE_FIELDS : []}
        error={error}
      />
    </div>
  );
}
