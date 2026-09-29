"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { StepForm, RatingStep, TextStep, type StepConfig } from "@/components/assessments/step-form";
import { assessmentPrompts } from "@/lib/assessment-prompts";
import { GoalsPanel } from "@/components/assessments/goals-panel";

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
  const [employeeName, setEmployeeName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cycleId) return;
    fetch(`/api/assessments/manager?cycleId=${cycleId}&employeeId=${employeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.length > 0) {
          const a = data[0];
          setAssessmentId(a.id);
          setIsSubmitted(!!a.submittedAt);
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
    const body = { cycleId, employeeId, ...values, submit };

    if (submit) setSubmitting(true);
    else setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/assessments/manager", {
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
          router.push(`/summary/${employeeId}?cycleId=${cycleId}`);
        }
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }, [cycleId, employeeId, values]);

  const steps: StepConfig[] = [
    {
      id: "performance",
      required: true,
      title: `Performance Rating${employeeName ? ` for ${employeeName}` : ""}`,
      description: "Rate this employee's performance against objectives.",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.performance?.manager} />,
    },
    {
      id: "performanceEvidence",
      title: "Performance Evidence",
      description: "What evidence supports this rating?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Describe specific examples of performance..." />,
    },
    {
      id: "growthReadiness",
      required: true,
      title: "Growth Readiness Rating",
      description: "Rate this employee's readiness for growth and advancement.",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} labels={{ 1: "Developing", 2: "Building", 3: "Ready Now" }} prompts={assessmentPrompts.growthReadiness?.manager} />,
    },
    {
      id: "growthReadinessEvidence",
      title: "Growth Readiness Evidence",
      description: "What evidence supports this growth readiness rating?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Describe growth indicators, learning agility..." />,
    },
    {
      id: "valCustomerFirst",
      required: true,
      title: "Customer First",
      description: "How well does this employee embody 'Customer First'?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valCustomerFirst?.manager} />,
    },
    {
      id: "valStepIntoArena",
      required: true,
      title: "Step Into the Arena",
      description: "How well does this employee take initiative and show courage?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valStepIntoArena?.manager} />,
    },
    {
      id: "valFlockToProblems",
      required: true,
      title: "Flock to Problems",
      description: "How well does this employee seek out and address challenges?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valFlockToProblems?.manager} />,
    },
    {
      id: "valGiveEnergy",
      required: true,
      title: "Give Energy",
      description: "How well does this employee energise and uplift the team?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.valGiveEnergy?.manager} />,
    },
    {
      id: "valuesEvidence",
      title: "Values Evidence",
      description: "Provide examples of values-aligned behaviour.",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Specific examples..." />,
    },
    {
      id: "engagement",
      required: true,
      title: "Engagement Rating",
      description: "How engaged does this employee appear?",
      render: (val, onChange) => <RatingStep value={val as number | null} onChange={onChange as (v: number) => void} prompts={assessmentPrompts.engagement?.manager} />,
    },
    {
      id: "engagementEvidence",
      title: "Engagement Evidence",
      description: "What observations support this engagement rating?",
      render: (val, onChange) => <TextStep value={val as string} onChange={onChange as (v: string) => void} placeholder="Observable behaviours..." />,
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
      <div className="text-center py-12 text-gray-500">
        No cycle selected. Go to your dashboard to start assessments.
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-visory-navy">Manager Assessment</h1>
          {employeeName && <p className="text-sm text-gray-600 mt-1">Assessing: {employeeName}</p>}
        </div>
      </div>
      <GoalsPanel employeeId={employeeId} />
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
