"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { StepForm, TextStep, MultiRatingStep, RatingWithComment, type StepConfig } from "@/components/assessments/step-form";
import { assessmentPrompts } from "@/lib/assessment-prompts";
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
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (!cycleId) return;
    fetch(`/api/assessments/self?cycleId=${cycleId}&prefill=true`)
      .then((r) => r.json())
      .then((data) => {
        if (data.length > 0) {
          const a = data[0];
          setAssessmentId(a.id);
          setIsSubmitted(!!a.submittedAt);
          const prev = a._prefilled;
          setValues({
            performance: a.performance,
            performanceJustification: a.performanceJustification || prev?.performanceJustification || "",
            achievements: a.achievements || prev?.achievements || "",
            blockers: a.blockers || prev?.blockers || "",
            learning: a.learning || prev?.learning || "",
            valCustomerFirst: a.valCustomerFirst,
            valStepIntoArena: a.valStepIntoArena,
            valFlockToProblems: a.valFlockToProblems,
            valGiveEnergy: a.valGiveEnergy,
            valuesReflection: a.valuesReflection || prev?.valuesReflection || "",
            engagement: a.engagement,
            engagementDriver: a.engagementDriver || prev?.engagementDriver || "",
            supportNeeded: a.supportNeeded || prev?.supportNeeded || "",
            goalsNextMonth: a.goalsNextMonth || prev?.goalsNextMonth || "",
          });
          if (prev) setPrefilled(true);
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

    try {
      const res = await fetch("/api/assessments/self", {
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

  const steps: StepConfig[] = [
    {
      id: "performance",
      title: "How would you rate your performance this quarter?",
      description: "Consider your output, quality of work, and meeting of objectives.",
      renderMulti: (vals, onChange) => (
        <RatingWithComment
          values={vals}
          onChange={onChange}
          ratingId="performance"
          commentId="performanceJustification"
          prompts={assessmentPrompts.performance?.self}
          commentPlaceholder="Describe your key contributions and the evidence behind your rating..."
        />
      ),
      // Mirror what the manager sees under their Performance step: the
      // goals & key-metrics panel plus the tasks/actions list. (No review
      // notes — those stay manager-only, as on the manager flow.)
      footer: session?.user?.id ? (
        <>
          <GoalsPanel employeeId={session.user.id} cycleId={cycleId} editable={!locked} showGoalNotes={false} />
          <ActionsEditor
            employeeId={session.user.id}
            readOnly
            assigneeOptions={[{ id: session.user.id, name: session.user.name || "You" }]}
          />
        </>
      ) : undefined,
    },
    {
      id: "achievements",
      title: "What are your key achievements this quarter?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="List your main accomplishments..." />,
    },
    {
      id: "blockers",
      title: "What blockers or challenges did you face?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Describe any obstacles that impacted your work..." />,
    },
    {
      id: "learning",
      title: "What did you learn this quarter?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Skills developed, insights gained..." />,
    },
    {
      id: "values",
      title: "Values Alignment",
      description: "Rate yourself against each value, then share overall reflections for the section.",
      renderMulti: (vals, onChange) => (
        <MultiRatingStep
          values={vals}
          onChange={onChange}
          commentId="valuesReflection"
          commentLabel="Values Reflection"
          commentPlaceholder="Give specific examples of how you demonstrated Visory values..."
          items={[
            { id: "valCustomerFirst", label: "Customer First", prompts: assessmentPrompts.valCustomerFirst?.self },
            { id: "valStepIntoArena", label: "Step Into the Arena", prompts: assessmentPrompts.valStepIntoArena?.self },
            { id: "valFlockToProblems", label: "Flock to Problems", prompts: assessmentPrompts.valFlockToProblems?.self },
            { id: "valGiveEnergy", label: "Give Energy", prompts: assessmentPrompts.valGiveEnergy?.self },
          ]}
        />
      ),
    },
    {
      id: "engagement",
      title: "How engaged do you feel at work?",
      description: "Consider your motivation, energy, and connection to the team.",
      renderMulti: (vals, onChange) => (
        <RatingWithComment
          values={vals}
          onChange={onChange}
          ratingId="engagement"
          commentId="engagementDriver"
          prompts={assessmentPrompts.engagement?.self}
          commentPlaceholder="What's driving your engagement level — what energises or drains you..."
        />
      ),
    },
    {
      id: "supportNeeded",
      title: "What support do you need from your manager?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Resources, guidance, feedback..." />,
    },
    {
      id: "goals",
      title: "What are your goals for next quarter?",
      description: "Add each goal individually. They are saved to your profile and tracked over time.",
      render: () => (session?.user?.id ? <SelfGoalsEditor employeeId={session.user.id} /> : null),
    },
  ];

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
        sub="Take your time. Your responses auto-save as drafts."
      />
      {prefilled && (
        <div className="rounded-lg bg-paper-2 border border-line p-3 mb-6 max-w-2xl mx-auto">
          <p className="text-sm text-ink-2">
            Text responses have been pre-filled from last quarter. Review and update as needed.
          </p>
        </div>
      )}
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
    </div>
  );
}
