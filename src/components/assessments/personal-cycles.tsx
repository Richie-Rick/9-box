"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GoalsPanel } from "@/components/assessments/goals-panel";
import type { CycleData } from "@/types";
import { formatCyclePeriod, comparePeriodDesc } from "@/lib/utils";
import { getValuesAlignment } from "@/lib/nine-box";

interface CycleSummary {
  cycleId: string;
  month: number | null;
  quarter: number | null;
  year: number;
  selfPerformance: number | null;
  mgrPerformance: number | null;
  mgrGrowthReadiness: number | null;
  selfEngagement: number | null;
  mgrEngagement: number | null;
  mgrValuesAlignment: number | null;
  selfSubmitted: boolean;
  mgrSubmitted: boolean;
  resultsSent: boolean;
}

interface PersonalCyclesSectionProps {
  /**
   * Compact mode is used on the manager dashboard: only the open-cycle
   * call-to-action, current-cycle status and performance summary are shown,
   * and nothing renders while loading or when there is nothing to act on.
   */
  compact?: boolean;
  /** Show the goals & key metrics panel (employee dashboard only). */
  showGoals?: boolean;
}

export function PersonalCyclesSection({ compact = false, showGoals = false }: PersonalCyclesSectionProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [cycleSummaries, setCycleSummaries] = useState<CycleSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;

    fetch("/api/cycles")
      .then((r) => r.json())
      .then(async (cycleData: CycleData[]) => {
        setCycles(cycleData);
        const summaries: CycleSummary[] = [];
        await Promise.all(
          cycleData.map(async (cycle) => {
            try {
              const res = await fetch(`/api/assessments/summary?employeeId=${session.user.id}&cycleId=${cycle.id}`);
              if (!res.ok) return;
              const data = await res.json();
              const self = data.selfAssessment;
              const mgr = data.managerAssessment;
              const mgrVA = mgr?.valCustomerFirst && mgr?.valStepIntoArena && mgr?.valFlockToProblems && mgr?.valGiveEnergy
                ? getValuesAlignment(mgr.valCustomerFirst, mgr.valStepIntoArena, mgr.valFlockToProblems, mgr.valGiveEnergy)
                : null;
              summaries.push({
                cycleId: cycle.id,
                month: cycle.month,
                quarter: cycle.quarter,
                year: cycle.year,
                selfPerformance: self?.performance ?? null,
                mgrPerformance: mgr?.performance ?? null,
                mgrGrowthReadiness: mgr?.growthReadiness ?? null,
                selfEngagement: self?.engagement ?? null,
                mgrEngagement: mgr?.engagement ?? null,
                mgrValuesAlignment: mgrVA,
                selfSubmitted: !!self?.submittedAt,
                mgrSubmitted: !!mgr?.submittedAt,
                resultsSent: !!mgr?.resultsSentAt,
              });
            } catch { /* skip */ }
          })
        );
        // Sort most recent first (quarter/legacy-month aware)
        summaries.sort(comparePeriodDesc);
        setCycleSummaries(summaries);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.user?.id]);

  if (loading) {
    return compact ? null : <div className="text-center py-12 muted">Loading...</div>;
  }

  const openCycle = cycles.find((c) => c.status === "OPEN");
  const openSummary = openCycle ? cycleSummaries.find((s) => s.cycleId === openCycle.id) : undefined;
  const needsSelfAssessment = !!openCycle && !openSummary?.selfSubmitted;
  const latestWithResults = cycleSummaries.find((s) => s.mgrSubmitted);

  // Goals & key metrics are scoped to the current cycle: prefer the open cycle,
  // otherwise the latest cycle we have any record for.
  const goalsCycleId = openCycle?.id ?? latestWithResults?.cycleId ?? cycleSummaries[0]?.cycleId ?? null;

  // Compute averages from cycles that have manager assessments
  const completedCycles = cycleSummaries.filter((s) => s.mgrSubmitted);
  const avgPerformance = completedCycles.length > 0
    ? completedCycles.reduce((sum, s) => sum + (s.mgrPerformance || 0), 0) / completedCycles.length
    : null;
  const avgGrowthReadiness = completedCycles.length > 0
    ? completedCycles.reduce((sum, s) => sum + (s.mgrGrowthReadiness || 0), 0) / completedCycles.length
    : null;
  const avgEngagement = completedCycles.length > 0
    ? completedCycles.reduce((sum, s) => sum + (s.mgrEngagement || 0), 0) / completedCycles.length
    : null;
  const avgValues = completedCycles.length > 0
    ? completedCycles.reduce((sum, s) => sum + (s.mgrValuesAlignment || 0), 0) / completedCycles.length
    : null;

  const invitationBanner = needsSelfAssessment && openCycle && (
    <Card navy className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="eyebrow mb-2">Cycle open</div>
        <p className="serif text-xl">
          The {formatCyclePeriod(openCycle)} cycle is open
        </p>
        <p className="text-white/70 text-sm mt-1">Complete your self-assessment to get started.</p>
      </div>
      <Button variant="magenta" onClick={() => router.push(`/self-assessment?cycleId=${openCycle.id}`)}>
        {openSummary?.selfPerformance != null ? "Continue Self-Assessment" : "Start Self-Assessment"}
      </Button>
    </Card>
  );

  const summaryCard = latestWithResults && (
    <Card>
      <CardHeader>
        <CardTitle>Your performance <em>summary.</em></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border border-line bg-paper-2 p-3 text-center">
            <p className="eyebrow mb-1">Performance</p>
            <p className="serif text-2xl mono tnum">
              {latestWithResults.mgrPerformance ?? "-"}
            </p>
            {avgPerformance !== null && (
              <p className="tiny muted mt-1">Avg: <span className="mono tnum">{avgPerformance.toFixed(1)}</span></p>
            )}
          </div>
          <div className="rounded-lg border border-line bg-paper-2 p-3 text-center">
            <p className="eyebrow mb-1">Growth Readiness</p>
            <p className="serif text-2xl mono tnum">
              {latestWithResults.mgrGrowthReadiness ?? "-"}
            </p>
            {avgGrowthReadiness !== null && (
              <p className="tiny muted mt-1">Avg: <span className="mono tnum">{avgGrowthReadiness.toFixed(1)}</span></p>
            )}
          </div>
          <div className="rounded-lg border border-line bg-paper-2 p-3 text-center">
            <p className="eyebrow mb-1">Values Alignment</p>
            <p className="serif text-2xl mono tnum">
              {latestWithResults.mgrValuesAlignment ?? "-"}
            </p>
            {avgValues !== null && (
              <p className="tiny muted mt-1">Avg: <span className="mono tnum">{avgValues.toFixed(1)}</span></p>
            )}
          </div>
          <div className="rounded-lg border border-line bg-paper-2 p-3 text-center">
            <p className="eyebrow mb-1">Engagement</p>
            <p className="serif text-2xl mono tnum">
              {latestWithResults.mgrEngagement ?? "-"}
            </p>
            {avgEngagement !== null && (
              <p className="tiny muted mt-1">Avg: <span className="mono tnum">{avgEngagement.toFixed(1)}</span></p>
            )}
          </div>
        </div>
        <p className="tiny muted mt-3 text-center">
          Current cycle: {formatCyclePeriod(latestWithResults)}
          {completedCycles.length > 1 && (
            <> · Avg across <span className="mono tnum">{completedCycles.length}</span> cycles</>
          )}
        </p>
      </CardContent>
    </Card>
  );

  if (compact) {
    const selfSubmittedCard = openCycle && openSummary?.selfSubmitted && (
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="eyebrow mb-2">Your assessment</div>
          <p className="text-sm text-ink">
            Self-assessment for {formatCyclePeriod(openCycle)} <Badge variant="success">Submitted</Badge>
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/my-reviews")}>
          View My Reviews
        </Button>
      </Card>
    );

    if (!invitationBanner && !selfSubmittedCard && !summaryCard) return null;
    return (
      <>
        {invitationBanner}
        {selfSubmittedCard}
        {summaryCard}
      </>
    );
  }

  return (
    <>
      {invitationBanner}
      {summaryCard}

      {/* Goals & Key Metrics — current cycle progress (read-only) */}
      {showGoals && session?.user?.id && (
        <GoalsPanel
          employeeId={session.user.id}
          cycleId={goalsCycleId}
          className=""
          defaultOpen
        />
      )}

      {/* Cycle Cards */}
      {cycleSummaries.length > 0 ? (
        cycleSummaries.map((summary) => {
          const cycle = cycles.find((c) => c.id === summary.cycleId);
          const isOpen = cycle?.status === "OPEN";
          return (
            <Card key={summary.cycleId}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{formatCyclePeriod(summary)}</CardTitle>
                  {isOpen && <Badge variant="success">Open</Badge>}
                  {summary.resultsSent && <Badge variant="success">Results Shared</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm muted-2">Self-Assessment</span>
                  <Badge variant={summary.selfSubmitted ? "success" : "slate"}>
                    {summary.selfSubmitted ? "Submitted" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm muted-2">Manager Assessment</span>
                  <Badge variant={summary.mgrSubmitted ? "success" : "slate"}>
                    {summary.mgrSubmitted ? "Submitted" : "Pending"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {!summary.selfSubmitted && isOpen && (
                    <Button variant="magenta" onClick={() => router.push(`/self-assessment?cycleId=${summary.cycleId}`)}>
                      {summary.selfPerformance !== null ? "Continue Self-Assessment" : "Start Self-Assessment"}
                    </Button>
                  )}
                  {(summary.selfSubmitted || summary.mgrSubmitted) && (
                    <Button variant="secondary" onClick={() => router.push("/my-reviews")}>
                      View Results
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      ) : openCycle ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{formatCyclePeriod(openCycle)}</CardTitle>
              <Badge variant="success">Open</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="magenta" onClick={() => router.push(`/self-assessment?cycleId=${openCycle.id}`)}>
              Start Self-Assessment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm muted py-4 text-center">
              No assessment cycles found. Check back when your manager opens a new cycle.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
