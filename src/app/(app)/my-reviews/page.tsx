"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatCyclePeriod } from "@/lib/utils";
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
import { buildComparisonRows } from "@/lib/comparison";

interface SelfAssessmentData {
  id: string;
  performance: number | null;
  performanceJustification: string | null;
  achievements: string | null;
  blockers: string | null;
  learning: string | null;
  growthReadiness: number | null;
  growthReflection: string | null;
  valCustomerFirst: number | null;
  valStepIntoArena: number | null;
  valFlockToProblems: number | null;
  valGiveEnergy: number | null;
  valuesReflection: string | null;
  engagement: number | null;
  engagementDriver: string | null;
  supportNeeded: string | null;
  goalsNextMonth: string | null;
  submittedAt: string | null;
}

interface ManagerAssessmentData {
  performance: number | null;
  performanceEvidence: string | null;
  growthReadiness: number | null;
  growthReadinessEvidence: string | null;
  valCustomerFirst: number | null;
  valStepIntoArena: number | null;
  valFlockToProblems: number | null;
  valGiveEnergy: number | null;
  valuesEvidence: string | null;
  engagement: number | null;
  engagementEvidence: string | null;
  achievementsObserved: string | null;
  blockersToRemove: string | null;
  supportCommitted: string | null;
  notes: string | null;
  submittedAt: string | null;
  resultsSentAt: string | null;
  manager: { id: string; name: string };
}

interface SummaryData {
  employee: { id: string; name: string };
  cycle: { id: string; month: number | null; quarter: number | null; year: number; status: string } | null;
  selfAssessment: SelfAssessmentData | null;
  managerAssessment: ManagerAssessmentData | null;
}

interface CycleData {
  id: string;
  month: number | null;
  quarter: number | null;
  year: number;
  status: string;
}

interface AuditEntry {
  id: string;
  action: string;
  summary: string | null;
  createdAt: string;
  actor: { id: string; name: string };
}

// Compact audit trail for an employee's own self-assessment.
function SelfAuditTrail({ selfAssessmentId }: { selfAssessmentId: string }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  useEffect(() => {
    fetch(`/api/audit?entityType=SelfAssessment&entityId=${selfAssessmentId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLogs(Array.isArray(d) ? d : []))
      .catch(() => setLogs([]));
  }, [selfAssessmentId]);

  if (logs.length === 0) return null;

  return (
    <div>
      <h3 className="eyebrow mb-2">History</h3>
      <ul className="space-y-2">
        {logs.map((log) => (
          <li key={log.id} className="text-sm text-ink-2 flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="mono tnum text-xs text-ink-3 whitespace-nowrap">
              {new Date(log.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </span>
            <span>
              <span className="font-medium text-ink">{log.actor.name}</span>
              {" — "}
              {log.summary || log.action}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
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
    return <div className="text-center py-12 text-ink-3">Loading...</div>;
  }

  const cyclesWithResults = cycles.filter((c) => summaries.has(c.id));

  if (cyclesWithResults.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="My Reviews"
          title={<>Your <em>reviews.</em></>}
          sub="Your scores, feedback, and prescribed actions"
        />
        <p className="text-ink-3">No reviews available yet. Reviews appear after assessments are submitted.</p>
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
        quarter: c.quarter,
        year: c.year,
        performance: mgr.performance,
        growthReadiness: mgr.growthReadiness,
        engagement: mgr.engagement,
        valuesAlignment: va,
      };
    })
    .filter(Boolean) as { month: number | null; quarter: number | null; year: number; performance: number; growthReadiness: number | null; engagement: number | null; valuesAlignment: number | null }[];

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
      <PageHeader
        eyebrow="My Reviews"
        title={<>Your <em>reviews.</em></>}
        sub="Your scores, feedback, and prescribed actions"
      />

      {latest && (
        <Card>
          <CardHeader>
            <span className="eyebrow">Overview</span>
            <h2 className="card-title">Performance Summary</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-paper-2 border border-line">
                <p className="eyebrow mb-1">Performance</p>
                <p className="mono tnum text-xl text-ink">{latest.performance}</p>
                {avgPerf !== null && completedSummaries.length > 1 && (
                  <p className="text-xs text-ink-3 mt-1">Avg: <span className="mono tnum">{avgPerf.toFixed(1)}</span></p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-paper-2 border border-line">
                <p className="eyebrow mb-1">Growth Readiness</p>
                <p className="mono tnum text-xl text-ink">{latest.growthReadiness ?? "-"}</p>
                {avgGrowth !== null && completedSummaries.length > 1 && (
                  <p className="text-xs text-ink-3 mt-1">Avg: <span className="mono tnum">{avgGrowth.toFixed(1)}</span></p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-paper-2 border border-line">
                <p className="eyebrow mb-1">Values Alignment</p>
                <p className="mono tnum text-xl text-ink">{latest.valuesAlignment ?? "-"}</p>
                {avgVA !== null && completedSummaries.length > 1 && (
                  <p className="text-xs text-ink-3 mt-1">Avg: <span className="mono tnum">{avgVA.toFixed(1)}</span></p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-paper-2 border border-line">
                <p className="eyebrow mb-1">Engagement</p>
                <p className="mono tnum text-xl text-ink">{latest.engagement ?? "-"}</p>
                {avgEng !== null && completedSummaries.length > 1 && (
                  <p className="text-xs text-ink-3 mt-1">Avg: <span className="mono tnum">{avgEng.toFixed(1)}</span></p>
                )}
              </div>
            </div>
            {completedSummaries.length > 1 && (
              <p className="text-xs text-ink-4 mt-3 text-center">
                Latest: <span className="mono tnum">{formatCyclePeriod(latest)}</span> · Averages across <span className="mono tnum">{completedSummaries.length}</span> cycles
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

        // Rows come from the shared section config; the manager side is
        // blank until results are shared.
        const sections = buildComparisonRows(self, mgr, { showManager });

        return (
          <Card key={cycle.id}>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <h2 className="card-title mono tnum">{formatCyclePeriod(cycle)}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {self?.submittedAt && (
                    <Badge variant="success">Self-Assessment Submitted</Badge>
                  )}
                  {mgr?.resultsSentAt ? (
                    <Badge variant="success">Results Shared</Badge>
                  ) : (
                    <Badge variant="warning">Pending Manager Review</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {showManager && (box1Label || box2Label) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {box1Label && (
                    <div className={`rounded-lg border-2 p-3 ${getBox1Color(box1Label)}`}>
                      <p className="eyebrow">Talent Density</p>
                      <p className="serif text-base mt-1">{box1Label}</p>
                      <p className="text-sm mt-1">{getBox1Action(box1Label)}</p>
                    </div>
                  )}
                  {box2Label && (
                    <div className={`rounded-lg border-2 p-3 ${getBox2Color(box2Label)}`}>
                      <p className="eyebrow">Cultural Momentum</p>
                      <p className="serif text-base mt-1">{box2Label}</p>
                      <p className="text-sm mt-1">{getBox2Action(box2Label)}</p>
                    </div>
                  )}
                </div>
              )}

              {(self?.submittedAt || showManager) && (
                <div>
                  <h3 className="eyebrow mb-3">
                    {showManager ? "Assessment Comparison" : "Your Ratings"}
                  </h3>
                  <p className="text-xs text-ink-3 mb-2">Click a dimension to expand and compare notes</p>
                  <DimensionComparison sections={sections} showManagerColumn={showManager} />
                </div>
              )}

              {self?.id && self?.submittedAt && <SelfAuditTrail selfAssessmentId={self.id} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
