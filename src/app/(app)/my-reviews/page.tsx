"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCyclePeriod } from "@/lib/utils";
import { buildComparisonRows } from "@/lib/comparison";
import {
  getBox1Label,
  getBox2Label,
  getValuesAlignment,
  getBox1Action,
  getBox2Action,
  getBox1Color,
  getBox2Color,
} from "@/lib/nine-box";
import { DimensionComparison } from "@/components/assessments/dimension-comparison";

interface SelfAssessmentData {
  [key: string]: unknown;
  performance: number | null;
  submittedAt: string | null;
}

interface ManagerAssessmentData {
  [key: string]: unknown;
  performance: number | null;
  growthReadiness: number | null;
  valCustomerFirst: number | null;
  valStepIntoArena: number | null;
  valFlockToProblems: number | null;
  valGiveEnergy: number | null;
  engagement: number | null;
  submittedAt: string | null;
  resultsSentAt: string | null;
  manager: { id: string; name: string };
}

interface SummaryData {
  employee: { id: string; name: string };
  cycle: { id: string; month: number; year: number; status: string } | null;
  selfAssessment: SelfAssessmentData | null;
  managerAssessment: ManagerAssessmentData | null;
}

interface CycleData {
  id: string;
  month: number;
  year: number;
  status: string;
}

export default function MyResultsPage() {
  const { data: session } = useSession();
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [summaries, setSummaries] = useState<Map<string, SummaryData>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;

    fetch("/api/cycles")
      .then((r) => r.json())
      .then(async (cycleData: CycleData[]) => {
        setCycles(cycleData);
        const results = new Map<string, SummaryData>();
        await Promise.all(
          cycleData.map(async (cycle) => {
            try {
              const res = await fetch(`/api/assessments/summary?employeeId=${session.user.id}&cycleId=${cycle.id}`);
              if (res.ok) {
                const data: SummaryData = await res.json();
                if (data.selfAssessment?.submittedAt || data.managerAssessment?.submittedAt) {
                  results.set(cycle.id, data);
                }
              }
            } catch { /* skip failed fetches */ }
          })
        );
        setSummaries(results);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.user?.id]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  const cyclesWithResults = cycles.filter((c) => summaries.has(c.id));

  if (cyclesWithResults.length === 0) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-visory-navy mb-2">My Reviews</h1>
        <p className="text-gray-500">No reviews available yet. Reviews appear after assessments are submitted.</p>
      </div>
    );
  }

  const completedSummaries = cyclesWithResults
    .map((c) => {
      const d = summaries.get(c.id)!;
      const mgr = d.managerAssessment;
      if (!mgr?.resultsSentAt || !mgr.performance) return null;
      const va = mgr.valCustomerFirst && mgr.valStepIntoArena && mgr.valFlockToProblems && mgr.valGiveEnergy
        ? getValuesAlignment(mgr.valCustomerFirst, mgr.valStepIntoArena, mgr.valFlockToProblems, mgr.valGiveEnergy)
        : null;
      return {
        month: c.month,
        year: c.year,
        performance: mgr.performance,
        growthReadiness: mgr.growthReadiness,
        engagement: mgr.engagement,
        valuesAlignment: va,
      };
    })
    .filter(Boolean) as { month: number; year: number; performance: number; growthReadiness: number | null; engagement: number | null; valuesAlignment: number | null }[];

  const latest = completedSummaries[0] ?? null;
  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter((v): v is number => v !== null);
    return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
  };
  const avgPerf = avg(completedSummaries.map((s) => s.performance));
  const avgGrowth = avg(completedSummaries.map((s) => s.growthReadiness));
  const avgEng = avg(completedSummaries.map((s) => s.engagement));
  const avgVA = avg(completedSummaries.map((s) => s.valuesAlignment));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-visory-navy">My Reviews</h1>
        <p className="text-sm text-gray-600 mt-1">Your scores, feedback, and prescribed actions</p>
      </div>

      {latest && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Performance Summary</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-visory-grey">
                <p className="text-xs text-gray-500 mb-1">Performance</p>
                <p className="text-xl font-bold text-visory-navy">{latest.performance}</p>
                {avgPerf !== null && completedSummaries.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">Avg: {avgPerf.toFixed(1)}</p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-visory-grey">
                <p className="text-xs text-gray-500 mb-1">Growth Readiness</p>
                <p className="text-xl font-bold text-visory-navy">{latest.growthReadiness ?? "-"}</p>
                {avgGrowth !== null && completedSummaries.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">Avg: {avgGrowth.toFixed(1)}</p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-visory-grey">
                <p className="text-xs text-gray-500 mb-1">Values Alignment</p>
                <p className="text-xl font-bold text-visory-navy">{latest.valuesAlignment ?? "-"}</p>
                {avgVA !== null && completedSummaries.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">Avg: {avgVA.toFixed(1)}</p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-visory-grey">
                <p className="text-xs text-gray-500 mb-1">Engagement</p>
                <p className="text-xl font-bold text-visory-navy">{latest.engagement ?? "-"}</p>
                {avgEng !== null && completedSummaries.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">Avg: {avgEng.toFixed(1)}</p>
                )}
              </div>
            </div>
            {completedSummaries.length > 1 && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                Latest: {formatCyclePeriod(latest.month, latest.year)} · Averages across {completedSummaries.length} cycles
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {cyclesWithResults.map((cycle) => {
        const data = summaries.get(cycle.id)!;
        const { selfAssessment: self, managerAssessment: mgr } = data;

        const mgrValuesAlignment = mgr?.valCustomerFirst && mgr?.valStepIntoArena && mgr?.valFlockToProblems && mgr?.valGiveEnergy
          ? getValuesAlignment(mgr.valCustomerFirst, mgr.valStepIntoArena, mgr.valFlockToProblems, mgr.valGiveEnergy)
          : null;
        const box1Label = mgr?.performance && mgr?.growthReadiness ? getBox1Label(mgr.performance, mgr.growthReadiness) : null;
        const box2Label = mgrValuesAlignment && mgr?.engagement ? getBox2Label(mgrValuesAlignment, mgr.engagement) : null;

        const showManager = !!mgr?.resultsSentAt;

        const rows = buildComparisonRows(self, mgr, { showManager });

        return (
          <Card key={cycle.id}>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{formatCyclePeriod(cycle.month, cycle.year)}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {self?.submittedAt && (
                    <Badge className="bg-green-100 text-green-800 border-green-300">Self-Assessment Submitted</Badge>
                  )}
                  {mgr?.resultsSentAt ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300">Results Shared</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300">Pending Manager Review</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {showManager && (box1Label || box2Label) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {box1Label && (
                    <div className={`rounded-lg border-2 p-3 ${getBox1Color(box1Label)}`}>
                      <p className="text-xs font-medium text-gray-500 uppercase">Talent Density</p>
                      <p className="text-base font-bold mt-1">{box1Label}</p>
                      <p className="text-sm text-visory-navy mt-1">{getBox1Action(box1Label)}</p>
                    </div>
                  )}
                  {box2Label && (
                    <div className={`rounded-lg border-2 p-3 ${getBox2Color(box2Label)}`}>
                      <p className="text-xs font-medium text-gray-500 uppercase">Cultural Momentum</p>
                      <p className="text-base font-bold mt-1">{box2Label}</p>
                      <p className="text-sm text-visory-navy mt-1">{getBox2Action(box2Label)}</p>
                    </div>
                  )}
                </div>
              )}

              {(self?.submittedAt || showManager) && (
                <div>
                  <h3 className="text-sm font-semibold text-visory-navy uppercase mb-3">
                    {showManager ? "Assessment Comparison" : "Your Ratings"}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">Click a dimension to expand and compare notes</p>
                  <DimensionComparison rows={rows} showManagerColumn={showManager} />
                </div>
              )}

            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
