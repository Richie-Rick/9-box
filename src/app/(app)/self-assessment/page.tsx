"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { StepForm, RatingStep, TextStep, type StepConfig } from "@/components/assessments/step-form";
import { assessmentPrompts } from "@/lib/assessment-prompts";
import { GoalsPanel } from "@/components/assessments/goals-panel";

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
  const [canEdit, setCanEdit] = useState(true);
  const [lastEditedAt, setLastEditedAt] = useState<string | null>(null);
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
          if (a._canEdit !== undefined) setCanEdit(a._canEdit);
          setLastEditedAt(a.lastEditedAt || null);
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
      (body as Record<string, unknown>).submit = true;
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
      if (!res.ok) {
        alert(data.error || "Failed to save");
        return;
      }
      setAssessmentId(data.id);
      setLastEditedAt(data.lastEditedAt || null);
      if (submit) {
        setIsSubmitted(true);
        if (data.bothComplete) {
          router.push(`/summary/${data.employeeId}?cycleId=${cycleId}`);
        }
      }
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }, [cycleId, values]);

  const steps: StepConfig[] = [
    {
      id: "performance",
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
      title: "Customer First",
      description: "How well did you embody the 'Customer First' value?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valCustomerFirst?.self} />,
    },
    {
      id: "valStepIntoArena",
      title: "Step Into the Arena",
      description: "How well did you step up and take initiative?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valStepIntoArena?.self} />,
    },
    {
      id: "valFlockToProblems",
      title: "Flock to Problems",
      description: "How well did you seek out and address challenges?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valFlockToProblems?.self} />,
    },
    {
      id: "valGiveEnergy",
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
      {prefilled && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-6 max-w-2xl mx-auto">
          <p className="text-sm text-blue-800">
            Text responses have been pre-filled from last month. Review and update as needed.
          </p>
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
        canEdit={canEdit}
        lastEditedAt={lastEditedAt}
      />
    </div>
  );
}
