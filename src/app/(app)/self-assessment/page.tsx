"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { StepForm, RatingStep, TextStep, type StepConfig } from "@/components/assessments/step-form";
import { assessmentPrompts } from "@/lib/assessment-prompts";
import { GoalsPanel } from "@/components/assessments/goals-panel";
import { formatCyclePeriod } from "@/lib/utils";

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
  const [previousGoals, setPreviousGoals] = useState<{ month: number; year: number; goalsNextMonth: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cycleId) return;
    fetch(`/api/assessments/self?cycleId=${cycleId}&prefill=true`)
      .then((r) => r.json())
      .then((data) => {
        if (data.length > 0) {
          const a = data[0];
          setAssessmentId(a.id);
          setIsSubmitted(!!a.submittedAt);
          setValues({
            performance: a.performance,
            performanceJustification: a.performanceJustification || "",
            achievements: a.achievements || "",
            blockers: a.blockers || "",
            learning: a.learning || "",
            valCustomerFirst: a.valCustomerFirst,
            valStepIntoArena: a.valStepIntoArena,
            valFlockToProblems: a.valFlockToProblems,
            valGiveEnergy: a.valGiveEnergy,
            valuesReflection: a.valuesReflection || "",
            engagement: a.engagement,
            engagementDriver: a.engagementDriver || "",
            supportNeeded: a.supportNeeded || "",
            goalsNextMonth: a.goalsNextMonth || "",
          });
          if (a._previous) setPreviousGoals(a._previous);
        }
      });
  }, [cycleId]);

  const save = useCallback(async (submit = false) => {
    if (!cycleId) return;
    const body = { cycleId, ...values, submit };

    if (submit) setSubmitting(true);
    else setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/assessments/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save. Please try again.");
        return;
      }
      setAssessmentId(data.id);
      if (submit) {
        setIsSubmitted(true);
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
  }, [cycleId, values]);

  const steps: StepConfig[] = [
    {
      id: "performance",
      required: true,
      title: "How would you rate your performance this month?",
      description: "Consider your output, quality of work, and meeting of objectives.",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.performance?.self} />,
    },
    {
      id: "performanceJustification",
      title: "What evidence supports your performance rating?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Describe your key contributions and results..." />,
    },
    {
      id: "achievements",
      title: "What are your key achievements this month?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="List your main accomplishments..." />,
    },
    {
      id: "blockers",
      title: "What blockers or challenges did you face?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Describe any obstacles that impacted your work..." />,
    },
    {
      id: "learning",
      title: "What did you learn this month?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Skills developed, insights gained..." />,
    },
    {
      id: "valCustomerFirst",
      required: true,
      title: "Customer First",
      description: "How well did you embody the 'Customer First' value?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valCustomerFirst?.self} />,
    },
    {
      id: "valStepIntoArena",
      required: true,
      title: "Step Into the Arena",
      description: "How well did you step up and take initiative?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valStepIntoArena?.self} />,
    },
    {
      id: "valFlockToProblems",
      required: true,
      title: "Flock to Problems",
      description: "How well did you seek out and address challenges?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valFlockToProblems?.self} />,
    },
    {
      id: "valGiveEnergy",
      required: true,
      title: "Give Energy",
      description: "How well did you energise and support those around you?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valGiveEnergy?.self} />,
    },
    {
      id: "valuesReflection",
      title: "Values Reflection",
      description: "Share examples of how you demonstrated Visory values.",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Give specific examples..." />,
    },
    {
      id: "engagement",
      required: true,
      title: "How engaged do you feel at work?",
      description: "Consider your motivation, energy, and connection to the team.",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.engagement?.self} />,
    },
    {
      id: "engagementDriver",
      title: "What's driving your engagement level?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="What energises or drains you at work..." />,
    },
    {
      id: "supportNeeded",
      title: "What support do you need from your manager?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Resources, guidance, feedback..." />,
    },
    {
      id: "goalsNextMonth",
      title: "What are your goals for next month?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Key priorities and objectives..." />,
    },
  ];

  if (!cycleId) {
    return (
      <div className="text-center py-12 text-gray-500">
        No cycle selected. Go to your dashboard to start an assessment.
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-visory-navy">Self-Assessment</h1>
        <p className="text-sm text-gray-600 mt-1">
          Take your time. Your responses auto-save as drafts.
        </p>
      </div>
      {previousGoals && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-6 max-w-2xl mx-auto">
          <p className="text-xs font-medium text-blue-700 uppercase mb-1">
            Last month ({formatCyclePeriod(previousGoals.month, previousGoals.year)}) you said your goals for this month were
          </p>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{previousGoals.goalsNextMonth}</p>
        </div>
      )}
      {session?.user?.id && <GoalsPanel employeeId={session.user.id} />}
      <StepForm
        steps={steps}
        values={values}
        onChange={(key, val) => setValues((v) => ({ ...v, [key]: val }))}
        onSave={() => save(false)}
        onSubmit={() => save(true)}
        saving={saving}
        submitting={submitting}
        isSubmitted={isSubmitted}
        error={error}
      />
    </div>
  );
}
