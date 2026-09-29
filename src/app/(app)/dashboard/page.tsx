"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { GoalsMetricsCard } from "@/components/goals/goals-metrics-card";
import { ShareModal } from "@/components/assessments/share-modal";
import { StageBadge } from "@/components/ui/stage-badge";
import type { CycleData, TeamMemberStatus, ManagerAssessmentData } from "@/types";
import { formatCyclePeriod } from "@/lib/utils";
import {
  getBox1Label,
  getBox2Label,
  getValuesAlignment,
  BOX1_GRID,
  BOX2_GRID,
  type GridCellConfig,
} from "@/lib/nine-box";

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (!role) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (role === "EMPLOYEE") return <EmployeeDashboard />;
  return <ManagerDashboard />;
}

interface EmployeeSummary {
  cycleId: string;
  month: number;
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

function EmployeeDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [cycleSummaries, setCycleSummaries] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;

    fetch("/api/cycles")
      .then((r) => r.json())
      .then(async (cycleData: CycleData[]) => {
        setCycles(cycleData);
        const summaries: EmployeeSummary[] = [];
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
                year: cycle.year,
                selfPerformance: self?.performance ?? null,
                mgrPerformance: mgr?.performance ?? null,
                mgrGrowthReadiness: mgr?.growthReadiness ?? null,
                selfEngagement: self?.engagement ?? null,
                mgrEngagement: mgr?.engagement ?? null,
                mgrValuesAlignment: mgrVA,
                selfSubmitted: !!self?.submittedAt,
                mgrSubmitted: !!mgr?.submittedAt,
                resultsSent: !!mgr?.sharedAt,
              });
            } catch { /* skip */ }
          })
        );
        // Sort by year desc, month desc
        summaries.sort((a, b) => b.year - a.year || b.month - a.month);
        setCycleSummaries(summaries);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.user?.id]);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  const openCycle = cycles.find((c) => c.status === "OPEN");
  // Only cycles whose results have been shared with the employee count
  const latestWithResults = cycleSummaries.find((s) => s.resultsSent);
  const completedCycles = cycleSummaries.filter((s) => s.resultsSent);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-visory-navy">My Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Your performance cycle status</p>
      </div>

      {/* Goals and metrics, always visible */}
      {session?.user?.id && (
        <GoalsMetricsCard
          employeeId={session.user.id}
          cycleId={openCycle?.id ?? null}
          variant="dashboard"
          isSelf
          title="My Goals & Key Metrics"
        />
      )}

      {/* Summary Card - averages & latest */}
      {latestWithResults && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Your Performance Summary</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-visory-grey">
                <p className="text-xs text-gray-500 mb-1">Performance</p>
                <p className="text-xl font-bold text-visory-navy">
                  {latestWithResults.mgrPerformance ?? "-"}
                </p>
                {avgPerformance !== null && completedCycles.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">Avg: {avgPerformance.toFixed(1)}</p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-visory-grey">
                <p className="text-xs text-gray-500 mb-1">Growth Readiness</p>
                <p className="text-xl font-bold text-visory-navy">
                  {latestWithResults.mgrGrowthReadiness ?? "-"}
                </p>
                {avgGrowthReadiness !== null && completedCycles.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">Avg: {avgGrowthReadiness.toFixed(1)}</p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-visory-grey">
                <p className="text-xs text-gray-500 mb-1">Values Alignment</p>
                <p className="text-xl font-bold text-visory-navy">
                  {latestWithResults.mgrValuesAlignment ?? "-"}
                </p>
                {avgValues !== null && completedCycles.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">Avg: {avgValues.toFixed(1)}</p>
                )}
              </div>
              <div className="text-center p-3 rounded-lg bg-visory-grey">
                <p className="text-xs text-gray-500 mb-1">Engagement</p>
                <p className="text-xl font-bold text-visory-navy">
                  {latestWithResults.mgrEngagement ?? "-"}
                </p>
                {avgEngagement !== null && completedCycles.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">Avg: {avgEngagement.toFixed(1)}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Showing {formatCyclePeriod(latestWithResults.month, latestWithResults.year)}
              {completedCycles.length > 1 && ` · Averages across ${completedCycles.length} cycles`}
            </p>
          </CardContent>
        </Card>
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
                  <h2 className="text-lg font-semibold">{formatCyclePeriod(summary.month, summary.year)}</h2>
                  {isOpen && (
                    <Badge className="bg-green-100 text-green-800 border-green-300">Open</Badge>
                  )}
                  {summary.resultsSent && (
                    <Badge className="bg-green-100 text-green-800 border-green-300">Results Shared</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Self-Assessment</span>
                  <Badge
                    className={
                      summary.selfSubmitted
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-gray-100 text-gray-800 border-gray-300"
                    }
                  >
                    {summary.selfSubmitted ? "Submitted" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Manager Review</span>
                  <Badge
                    className={
                      summary.resultsSent
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-gray-100 text-gray-800 border-gray-300"
                    }
                  >
                    {summary.resultsSent ? "Shared" : "Not yet shared"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {!summary.selfSubmitted && isOpen && (
                    <Button onClick={() => router.push(`/self-assessment?cycleId=${summary.cycleId}`)}>
                      {summary.selfPerformance !== null ? "Continue Self-Assessment" : "Start Self-Assessment"}
                    </Button>
                  )}
                  {(summary.selfSubmitted || summary.resultsSent) && (
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
              <h2 className="text-lg font-semibold">{formatCyclePeriod(openCycle.month, openCycle.year)}</h2>
              <Badge className="bg-green-100 text-green-800 border-green-300">Open</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/self-assessment?cycleId=${openCycle.id}`)}>
              Start Self-Assessment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500 py-4 text-center">
              No assessment cycles found. Check back when your manager opens a new cycle.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface PlacedEmployee {
  id: string;
  name: string;
  role: string;
  jobTitle: string | null;
  team: string | null;
  box1Label: string;
  box2Label: string;
  performance: number;
  growthReadiness: number;
  valuesAlignment: number;
  engagement: number;
}

function ManagerDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [cycle, setCycle] = useState<CycleData | null>(null);
  const [team, setTeam] = useState<TeamMemberStatus[]>([]);
  const [assessments, setAssessments] = useState<ManagerAssessmentData[]>([]);
  const [activeGrid, setActiveGrid] = useState<"box1" | "box2">("box1");
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [shareConfirm, setShareConfirm] = useState<TeamMemberStatus | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetch("/api/cycles")
      .then((r) => r.json())
      .then((data: CycleData[]) => {
        setCycles(data);
        // Default to the open cycle so Assess never lands on a closed one
        const initial = data.find((c) => c.status === "OPEN") ?? data[0] ?? null;
        setCycle(initial);
      });
  }, []);

  useEffect(() => {
    if (!cycle) return;
    fetch(`/api/team?cycleId=${cycle.id}`)
      .then((r) => r.json())
      .then((data) => setTeam(Array.isArray(data) ? data : []));
    fetch(`/api/assessments/manager?cycleId=${cycle.id}`)
      .then((r) => r.json())
      .then((data) => setAssessments(Array.isArray(data) ? data : []));
  }, [cycle]);

  const assessed = team.filter((t) => t.managerAssessmentStatus === "submitted").length;
  const selfDone = team.filter((t) => t.selfAssessmentStatus === "submitted").length;

  const placedEmployees = useMemo<PlacedEmployee[]>(() => {
    return assessments
      .filter((a) => a.submittedAt && a.performance && a.growthReadiness && a.engagement && a.valCustomerFirst && a.valStepIntoArena && a.valFlockToProblems && a.valGiveEnergy)
      .map((a) => {
        const va = getValuesAlignment(a.valCustomerFirst!, a.valStepIntoArena!, a.valFlockToProblems!, a.valGiveEnergy!);
        return {
          id: a.employeeId,
          name: a.employee?.name || "Unknown",
          role: a.employee?.role || "EMPLOYEE",
          jobTitle: a.employee?.jobTitle || null,
          team: a.employee?.team || null,
          box1Label: getBox1Label(a.performance!, a.growthReadiness!),
          box2Label: getBox2Label(va, a.engagement!),
          performance: a.performance!,
          growthReadiness: a.growthReadiness!,
          valuesAlignment: va,
          engagement: a.engagement!,
        };
      });
  }, [assessments]);

  const titleOptions = useMemo(() => [...new Set(placedEmployees.map((e) => e.jobTitle).filter(Boolean) as string[])].sort(), [placedEmployees]);
  const teamOptions = useMemo(() => [...new Set(placedEmployees.map((e) => e.team).filter(Boolean) as string[])].sort(), [placedEmployees]);

  const filteredEmployees = useMemo(() => {
    return placedEmployees.filter((e) => {
      if (selectedTitles.length > 0 && (!e.jobTitle || !selectedTitles.includes(e.jobTitle))) return false;
      if (selectedTeams.length > 0 && (!e.team || !selectedTeams.includes(e.team))) return false;
      return true;
    });
  }, [placedEmployees, selectedTitles, selectedTeams]);

  const grid = activeGrid === "box1" ? BOX1_GRID : BOX2_GRID;
  const xLabel = activeGrid === "box1" ? "Performance" : "Values Alignment";
  const yLabel = activeGrid === "box1" ? "Growth Readiness" : "Engagement";

  async function handleShare(member: TeamMemberStatus) {
    if (!member.managerAssessmentId) return;
    setSharing(true);
    try {
      const res = await fetch("/api/assessments/manager/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: member.managerAssessmentId }),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setTeam((prev) => prev.map((m) => m.id === member.id ? { ...m, sharedAt: now, stage: m.stage === "meeting_done" ? m.stage : "shared" } : m));
      }
    } finally {
      setSharing(false);
      setShareConfirm(null);
    }
  }

  function getEmployeesForCell(cell: GridCellConfig) {
    return filteredEmployees.filter((e) => {
      if (activeGrid === "box1") return e.performance === cell.x && e.growthReadiness === cell.y;
      return e.valuesAlignment === cell.x && e.engagement === cell.y;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-visory-navy">Dashboard</h1>
          {cycles.length > 0 && cycle && (
            <div className="flex items-center gap-2">
              <select
                value={cycle.id}
                onChange={(e) => setCycle(cycles.find((c) => c.id === e.target.value) ?? null)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-visory"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>{formatCyclePeriod(c.month, c.year)}</option>
                ))}
              </select>
              <Badge className={cycle.status === "OPEN" ? "bg-green-100 text-green-800 border-green-300" : "bg-gray-100 text-gray-800 border-gray-300"}>
                {cycle.status === "OPEN" ? "Open" : "Closed"}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Admin quick links */}
      {role === "ADMIN" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/admin/cycles")}>
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold text-visory-navy">Assessment Cycles</h3>
              <p className="text-xs text-gray-600 mt-1">Open, close, and manage monthly cycles</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/admin/users")}>
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold text-visory-navy">User Management</h3>
              <p className="text-xs text-gray-600 mt-1">Invite users, assign roles and managers</p>
            </CardContent>
          </Card>
        </div>
      )}

      {cycle && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="py-4">
                <p className="text-2xl font-bold text-visory">{selfDone}/{team.length}</p>
                <p className="text-sm text-gray-600">Self-Assessments Done</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-2xl font-bold text-visory">{assessed}/{team.length}</p>
                <p className="text-sm text-gray-600">Manager Assessments Done</p>
              </CardContent>
            </Card>
          </div>

          {/* 9-Box Grid */}
          {placedEmployees.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">9-Box Grid</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <MultiSelect label="Titles" options={titleOptions} selected={selectedTitles} onChange={setSelectedTitles} />
                    <MultiSelect label="Teams" options={teamOptions} selected={selectedTeams} onChange={setSelectedTeams} />
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                      <button
                        onClick={() => setActiveGrid("box1")}
                        className={`px-3 py-1.5 text-xs font-medium ${activeGrid === "box1" ? "bg-visory text-white" : "bg-white text-visory-navy hover:bg-gray-50"}`}
                      >
                        Talent Density
                      </button>
                      <button
                        onClick={() => setActiveGrid("box2")}
                        className={`px-3 py-1.5 text-xs font-medium ${activeGrid === "box2" ? "bg-visory text-white" : "bg-white text-visory-navy hover:bg-gray-50"}`}
                      >
                        Cultural Momentum
                      </button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <div className="flex flex-col justify-between items-center w-8 py-4">
                    <span className="text-xs font-medium text-gray-500 -rotate-90 whitespace-nowrap">High</span>
                    <span className="text-xs font-semibold text-visory-navy -rotate-90 whitespace-nowrap">{yLabel}</span>
                    <span className="text-xs font-medium text-gray-500 -rotate-90 whitespace-nowrap">Low</span>
                  </div>
                  <div className="flex-1">
                    <div className="grid grid-cols-3 gap-2">
                      {grid.map((cell) => {
                        const emps = getEmployeesForCell(cell);
                        return (
                          <div
                            key={`${cell.x}-${cell.y}`}
                            className={`rounded-lg border-2 p-3 min-h-[80px] ${cell.colorClass}`}
                          >
                            <p className="text-xs font-semibold text-visory-navy mb-1">{cell.label}</p>
                            <div className="flex flex-wrap gap-1">
                              {emps.map((emp) => (
                                <span
                                  key={emp.id}
                                  onClick={() => router.push(`/team/${emp.id}`)}
                                  className="cursor-pointer"
                                >
                                  <Badge className="bg-white/80 text-gray-800 border-gray-300 text-xs hover:bg-white">
                                    {emp.name}
                                  </Badge>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center mt-2 px-4">
                      <span className="text-xs font-medium text-gray-500">Low</span>
                      <span className="text-xs font-semibold text-visory-navy">{xLabel}</span>
                      <span className="text-xs font-medium text-gray-500">High</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Roster */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Team Roster</h2>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100">
                {team.map((member) => (
                  <div key={member.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => router.push(`/team/${member.id}`)}
                    >
                      <p className="text-sm font-medium text-visory-navy hover:underline">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StageBadge stage={member.stage} />
                      <span className="text-xs text-gray-500">
                        Self {member.selfAssessmentStatus === "submitted" ? "in" : member.selfAssessmentStatus === "draft" ? "draft" : "pending"}
                      </span>
                      <Button
                        size="sm"
                        variant={member.managerAssessmentStatus === "submitted" ? "ghost" : "primary"}
                        onClick={() => router.push(`/assess/${member.id}?cycleId=${cycle.id}`)}
                      >
                        {member.managerAssessmentStatus === "submitted" ? "View" : "Assess"}
                      </Button>
                      {member.managerAssessmentStatus === "submitted" && !member.sharedAt && (
                        <Button size="sm" variant="primary" onClick={() => setShareConfirm(member)}>
                          Share
                        </Button>
                      )}
                      {member.sharedAt && !member.oneOnOneCompletedAt && (
                        <Button size="sm" variant="secondary" onClick={() => router.push(`/summary/${member.id}?cycleId=${cycle.id}&mode=meeting`)}>
                          Meeting
                        </Button>
                      )}
                      {member.oneOnOneCompletedAt && (
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/summary/${member.id}?cycleId=${cycle.id}`)}>
                          Summary
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {team.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-500">
                    No team members found. Ask your admin to assign employees to you.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {shareConfirm && (
        <ShareModal
          memberName={shareConfirm.name}
          selfSubmitted={shareConfirm.selfAssessmentStatus === "submitted"}
          busy={sharing}
          onConfirm={() => handleShare(shareConfirm)}
          onCancel={() => setShareConfirm(null)}
        />
      )}
    </div>
  );
}
