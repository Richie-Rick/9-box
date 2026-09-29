"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import type { CycleData, ManagerAssessmentData } from "@/types";
import { formatCyclePeriod } from "@/lib/utils";
import { metricDisconnect } from "@/lib/job-roles";
import {
  getBox1Label,
  getBox2Label,
  getValuesAlignment,
  getBox1Action,
  getBox2Action,
  BOX1_GRID,
  BOX2_GRID,
  BOX1_TIERS,
  BOX2_TIERS,
  getTier,
  type GridCellConfig,
  type Tier,
} from "@/lib/nine-box";

interface MetricResultRow {
  employeeId: string;
  achieved: boolean | null;
  keyMetric: { name: string } | null;
  metricTemplate: { name: string } | null;
}

interface PlacedEmployee {
  id: string;
  name: string;
  role: string;
  jobTitle: string | null;
  team: string | null;
  managerId: string | null;
  managerName: string | null;
  editCount: number;
  ratingAdjusted: boolean;
  box1Label: string;
  box2Label: string;
  performance: number;
  growthReadiness: number;
  valuesAlignment: number;
  engagement: number;
}

function computePlaced(assessments: ManagerAssessmentData[]): PlacedEmployee[] {
  return assessments
    .filter((a) => a.submittedAt && a.performance && a.growthReadiness && a.engagement && a.valCustomerFirst && a.valStepIntoArena && a.valFlockToProblems && a.valGiveEnergy)
    .map((a) => {
      const va = getValuesAlignment(a.valCustomerFirst!, a.valStepIntoArena!, a.valFlockToProblems!, a.valGiveEnergy!);
      const initial = a.initialRatings ?? null;
      const ratingAdjusted = !!initial && Object.entries(initial).some(([field, value]) => (a as unknown as Record<string, unknown>)[field] !== value);
      return {
        id: a.employeeId,
        name: a.employee?.name || "Unknown",
        role: a.employee?.role || "EMPLOYEE",
        jobTitle: a.employee?.jobTitle || null,
        team: a.employee?.team || null,
        managerId: a.manager?.id ?? null,
        managerName: a.manager?.name ?? null,
        editCount: a.editCount ?? 0,
        ratingAdjusted,
        box1Label: getBox1Label(a.performance!, a.growthReadiness!),
        box2Label: getBox2Label(va, a.engagement!),
        performance: a.performance!,
        growthReadiness: a.growthReadiness!,
        valuesAlignment: va,
        engagement: a.engagement!,
      };
    });
}

function computeInsights(employees: PlacedEmployee[]) {
  if (employees.length === 0) return null;
  const total = employees.length;
  const avgPerf = employees.reduce((s, e) => s + e.performance, 0) / total;
  const avgGrowth = employees.reduce((s, e) => s + e.growthReadiness, 0) / total;
  const avgValues = employees.reduce((s, e) => s + e.valuesAlignment, 0) / total;
  const avgEngagement = employees.reduce((s, e) => s + e.engagement, 0) / total;
  const avgTD = employees.reduce((s, e) => s + e.performance * e.growthReadiness, 0) / total;
  const avgCM = employees.reduce((s, e) => s + e.valuesAlignment * e.engagement, 0) / total;

  const topTalent = employees.filter((e) =>
    e.box1Label === "Ready to Promote" || e.box1Label === "Stretch & Develop" || e.box1Label === "Expand the Role"
  ).length;
  const atRisk = employees.filter((e) =>
    e.box2Label === "Have the Conversation" || e.box2Label === "Find What's Draining"
  ).length;
  const intervene = employees.filter((e) =>
    e.box1Label === "Intervene Now" || e.box2Label === "Assess the Fit"
  ).length;

  return { avgPerf, avgGrowth, avgValues, avgEngagement, avgTD, avgCM, topTalent, atRisk, intervene, total };
}

export default function CalibrationPage() {
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [assessments, setAssessments] = useState<ManagerAssessmentData[]>([]);
  const [prevAssessments, setPrevAssessments] = useState<ManagerAssessmentData[]>([]);
  const [activeGrid, setActiveGrid] = useState<"box1" | "box2">("box1");
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [gridView, setGridView] = useState<"names" | "counts" | "heatmap">("names");
  const [metricResults, setMetricResults] = useState<MetricResultRow[]>([]);
  const [drafts, setDrafts] = useState<ManagerAssessmentData[]>([]);
  const [viewMode, setViewMode] = useState<"single" | "range">("single");
  const [rangeStartId, setRangeStartId] = useState<string>("");
  const [rangeEndId, setRangeEndId] = useState<string>("");
  const [rangeAssessments, setRangeAssessments] = useState<ManagerAssessmentData[][]>([]);

  useEffect(() => {
    fetch("/api/cycles").then((r) => r.json()).then((data: CycleData[]) => {
      const sorted = [...data].sort((a, b) => (b.year - a.year) || (b.month - a.month));
      setCycles(sorted);
      const open = sorted.find((c) => c.status === "OPEN");
      if (open) setSelectedCycleId(open.id);
      else if (sorted.length > 0) setSelectedCycleId(sorted[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedCycleId || viewMode !== "single") return;
    fetch(`/api/assessments/manager?cycleId=${selectedCycleId}`)
      .then((r) => r.json())
      .then((data) => {
        const list: ManagerAssessmentData[] = Array.isArray(data) ? data : [];
        setAssessments(list.filter((a) => a.submittedAt));
        setDrafts(list.filter((a) => !a.submittedAt));
      });
    fetch(`/api/key-metrics/results?cycleId=${selectedCycleId}`)
      .then((r) => r.json())
      .then((data) => setMetricResults(Array.isArray(data) ? data : []));

    const idx = cycles.findIndex((c) => c.id === selectedCycleId);
    const prevCycle = idx >= 0 && idx < cycles.length - 1 ? cycles[idx + 1] : null;
    const prevRequest = prevCycle
      ? fetch(`/api/assessments/manager?cycleId=${prevCycle.id}`).then((r) => r.json())
      : Promise.resolve([]);
    prevRequest.then(setPrevAssessments);
  }, [selectedCycleId, cycles, viewMode]);

  useEffect(() => {
    if (viewMode !== "range" || !rangeStartId || !rangeEndId) return;
    const startIdx = cycles.findIndex((c) => c.id === rangeStartId);
    const endIdx = cycles.findIndex((c) => c.id === rangeEndId);
    if (startIdx < 0 || endIdx < 0) return;

    const rangeCycles = cycles.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
    Promise.all(
      rangeCycles.map((c) =>
        fetch(`/api/assessments/manager?cycleId=${c.id}`).then((r) => r.json())
      )
    ).then(setRangeAssessments);
  }, [viewMode, rangeStartId, rangeEndId, cycles]);

  const placedEmployees = useMemo<PlacedEmployee[]>(() => {
    if (viewMode === "range" && rangeAssessments.length > 0) {
      const allAssessments = rangeAssessments.flat();
      const byEmployee = new Map<string, ManagerAssessmentData[]>();
      allAssessments.forEach((a) => {
        if (!byEmployee.has(a.employeeId)) byEmployee.set(a.employeeId, []);
        byEmployee.get(a.employeeId)!.push(a);
      });

      const averaged: PlacedEmployee[] = [];
      byEmployee.forEach((empAssessments) => {
        const valid = empAssessments.filter((a) => a.submittedAt && a.performance && a.growthReadiness && a.engagement && a.valCustomerFirst && a.valStepIntoArena && a.valFlockToProblems && a.valGiveEnergy);
        if (valid.length === 0) return;
        const n = valid.length;
        const avgPerf = Math.round(valid.reduce((s, a) => s + a.performance!, 0) / n);
        const avgGrowth = Math.round(valid.reduce((s, a) => s + a.growthReadiness!, 0) / n);
        const avgEng = Math.round(valid.reduce((s, a) => s + a.engagement!, 0) / n);
        const avgVa = Math.round(valid.reduce((s, a) => s + getValuesAlignment(a.valCustomerFirst!, a.valStepIntoArena!, a.valFlockToProblems!, a.valGiveEnergy!), 0) / n);
        const first = valid[0];
        averaged.push({
          id: first.employeeId,
          name: first.employee?.name || "Unknown",
          role: first.employee?.role || "EMPLOYEE",
          jobTitle: first.employee?.jobTitle || null,
          team: first.employee?.team || null,
          managerId: first.manager?.id ?? null,
          managerName: first.manager?.name ?? null,
          editCount: valid.reduce((sum, a) => sum + (a.editCount ?? 0), 0),
          ratingAdjusted: false,
          box1Label: getBox1Label(avgPerf, avgGrowth),
          box2Label: getBox2Label(avgVa, avgEng),
          performance: avgPerf,
          growthReadiness: avgGrowth,
          valuesAlignment: avgVa,
          engagement: avgEng,
        });
      });
      return averaged;
    }
    return computePlaced(assessments);
  }, [assessments, viewMode, rangeAssessments]);

  const prevPlacedEmployees = useMemo<PlacedEmployee[]>(() => computePlaced(prevAssessments), [prevAssessments]);

  const titleOptions = useMemo(() => [...new Set(placedEmployees.map((e) => e.jobTitle).filter(Boolean) as string[])].sort(), [placedEmployees]);
  const teamOptions = useMemo(() => [...new Set(placedEmployees.map((e) => e.team).filter(Boolean) as string[])].sort(), [placedEmployees]);
  const managerOptions = useMemo(() => [...new Set(placedEmployees.map((e) => e.managerName).filter(Boolean) as string[])].sort(), [placedEmployees]);

  const applyFilters = (list: PlacedEmployee[]) =>
    list.filter((e) => {
      if (selectedTitles.length > 0 && (!e.jobTitle || !selectedTitles.includes(e.jobTitle))) return false;
      if (selectedTeams.length > 0 && (!e.team || !selectedTeams.includes(e.team))) return false;
      if (selectedManagers.length > 0 && (!e.managerName || !selectedManagers.includes(e.managerName))) return false;
      return true;
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredEmployees = useMemo(() => applyFilters(placedEmployees), [placedEmployees, selectedTitles, selectedTeams, selectedManagers]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredPrev = useMemo(() => applyFilters(prevPlacedEmployees), [prevPlacedEmployees, selectedTitles, selectedTeams, selectedManagers]);

  // Rating versus metric results, per employee in the selected cycle
  const disconnects = useMemo(() => {
    if (viewMode !== "single") return [];
    const byEmployee = new Map<string, MetricResultRow[]>();
    for (const r of metricResults) {
      if (!byEmployee.has(r.employeeId)) byEmployee.set(r.employeeId, []);
      byEmployee.get(r.employeeId)!.push(r);
    }
    return filteredEmployees
      .map((e) => {
        const results = byEmployee.get(e.id) ?? [];
        const { hit, missed, disconnect } = metricDisconnect(e.performance, results);
        const missedNames = results.filter((r) => r.achieved === false).map((r) => r.keyMetric?.name ?? r.metricTemplate?.name ?? "metric");
        return { employee: e, hit, missed, disconnect, missedNames };
      })
      .filter((d) => d.disconnect);
  }, [filteredEmployees, metricResults, viewMode]);

  const tierCounts = useMemo(() => {
    const tiers = activeGrid === "box1" ? BOX1_TIERS : BOX2_TIERS;
    const counts: Record<Tier, number> = { top: 0, medium: 0, low: 0 };
    for (const e of filteredEmployees) {
      counts[getTier(activeGrid === "box1" ? e.box1Label : e.box2Label, tiers)] += 1;
    }
    return counts;
  }, [filteredEmployees, activeGrid]);

  // Per-manager rollup for the leadership view
  const managerRollup = useMemo(() => {
    if (viewMode !== "single") return [];
    const disconnectIds = new Set(disconnects.map((d) => d.employee.id));
    const groups = new Map<string, { name: string; employees: PlacedEmployee[]; drafts: number }>();
    for (const e of filteredEmployees) {
      const key = e.managerId ?? "none";
      if (!groups.has(key)) groups.set(key, { name: e.managerName ?? "No manager", employees: [], drafts: 0 });
      groups.get(key)!.employees.push(e);
    }
    for (const d of drafts) {
      const key = d.manager?.id ?? "none";
      if (selectedManagers.length > 0 && (!d.manager?.name || !selectedManagers.includes(d.manager.name))) continue;
      if (!groups.has(key)) groups.set(key, { name: d.manager?.name ?? "No manager", employees: [], drafts: 0 });
      groups.get(key)!.drafts += 1;
    }
    const tiers = activeGrid === "box1" ? BOX1_TIERS : BOX2_TIERS;
    return [...groups.entries()]
      .map(([id, g]) => {
        const n = g.employees.length;
        return {
          id,
          name: g.name,
          submitted: n,
          total: n + g.drafts,
          avgTD: n ? g.employees.reduce((s, e) => s + e.performance * e.growthReadiness, 0) / n : 0,
          avgCM: n ? g.employees.reduce((s, e) => s + e.valuesAlignment * e.engagement, 0) / n : 0,
          topPct: n ? (g.employees.filter((e) => getTier(activeGrid === "box1" ? e.box1Label : e.box2Label, tiers) === "top").length / n) * 100 : 0,
          edited: g.employees.filter((e) => e.editCount > 0).length,
          adjusted: g.employees.filter((e) => e.ratingAdjusted).length,
          disconnects: g.employees.filter((e) => disconnectIds.has(e.id)).length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredEmployees, drafts, disconnects, viewMode, activeGrid, selectedManagers]);

  const currentInsights = useMemo(() => computeInsights(filteredEmployees), [filteredEmployees]);
  const prevInsights = useMemo(() => computeInsights(filteredPrev), [filteredPrev]);

  const grid = activeGrid === "box1" ? BOX1_GRID : BOX2_GRID;
  const xLabel = activeGrid === "box1" ? "Performance" : "Values Alignment";
  const yLabel = activeGrid === "box1" ? "Growth Readiness" : "Engagement";

  function getEmployeesForCell(cell: GridCellConfig) {
    return filteredEmployees.filter((e) => {
      if (activeGrid === "box1") {
        return e.performance === cell.x && e.growthReadiness === cell.y;
      }
      return e.valuesAlignment === cell.x && e.engagement === cell.y;
    });
  }

  const selectedCycleLabel = cycles.find((c) => c.id === selectedCycleId);
  const prevCycleLabel = (() => {
    const idx = cycles.findIndex((c) => c.id === selectedCycleId);
    return idx >= 0 && idx < cycles.length - 1 ? cycles[idx + 1] : null;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-visory-navy">Analysis</h1>
          <p className="text-sm text-gray-600 mt-1">Team performance analysis and 9-box insights</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode("single")}
              className={`px-3 py-2 text-xs font-medium ${viewMode === "single" ? "bg-visory-navy text-white" : "bg-white text-visory-navy hover:bg-gray-50"}`}
            >
              Single Month
            </button>
            <button
              onClick={() => { setViewMode("range"); if (!rangeStartId && cycles.length > 0) { setRangeStartId(cycles[cycles.length - 1].id); setRangeEndId(cycles[0].id); } }}
              className={`px-3 py-2 text-xs font-medium ${viewMode === "range" ? "bg-visory-navy text-white" : "bg-white text-visory-navy hover:bg-gray-50"}`}
            >
              Period Average
            </button>
          </div>

          {viewMode === "single" ? (
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-visory"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>{formatCyclePeriod(c.month, c.year)}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={rangeStartId}
                onChange={(e) => setRangeStartId(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:ring-visory"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>{formatCyclePeriod(c.month, c.year)}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500">to</span>
              <select
                value={rangeEndId}
                onChange={(e) => setRangeEndId(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:ring-visory"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>{formatCyclePeriod(c.month, c.year)}</option>
                ))}
              </select>
            </div>
          )}

          <MultiSelect label="Titles" options={titleOptions} selected={selectedTitles} onChange={setSelectedTitles} />
          <MultiSelect label="Teams" options={teamOptions} selected={selectedTeams} onChange={setSelectedTeams} />
          <MultiSelect label="Managers" options={managerOptions} selected={selectedManagers} onChange={setSelectedManagers} />
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setActiveGrid("box1")}
              className={`px-3 py-2 text-sm font-medium ${activeGrid === "box1" ? "bg-visory text-white" : "bg-white text-visory-navy hover:bg-gray-50"}`}
            >
              Talent Density
            </button>
            <button
              onClick={() => setActiveGrid("box2")}
              className={`px-3 py-2 text-sm font-medium ${activeGrid === "box2" ? "bg-visory text-white" : "bg-white text-visory-navy hover:bg-gray-50"}`}
            >
              Cultural Momentum
            </button>
          </div>
        </div>
      </div>

      {/* 9-Box Grid */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-end mb-3">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
              {(["names", "counts", "heatmap"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setGridView(v)}
                  className={`px-3 py-1.5 capitalize ${gridView === v ? "bg-visory-navy text-white" : "bg-white text-visory-navy hover:bg-gray-50"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
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
                  const share = filteredEmployees.length > 0 ? emps.length / filteredEmployees.length : 0;
                  const heat = gridView === "heatmap" ? { backgroundColor: `rgba(223, 0, 116, ${0.08 + share * 0.7})` } : undefined;
                  return (
                    <div
                      key={`${cell.x}-${cell.y}`}
                      className={`rounded-lg border-2 p-3 min-h-[100px] ${gridView === "heatmap" ? "border-gray-200" : cell.colorClass}`}
                      style={heat}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-visory-navy">{cell.label}</p>
                        <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">
                          {emps.length} ({Math.round(share * 100)}%)
                        </span>
                      </div>
                      {gridView === "names" && (
                        <div className="flex flex-wrap gap-1">
                          {emps.map((emp) => (
                            <Link key={emp.id} href={`/summary/${emp.id}?cycleId=${selectedCycleId}`}>
                              <Badge className="bg-white/80 text-gray-800 border-gray-300 text-xs cursor-pointer hover:bg-visory-light hover:border-visory/40 transition-colors">
                                {emp.name}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      )}
                      {gridView !== "names" && (
                        <p className={`text-2xl font-bold ${gridView === "heatmap" && share > 0.45 ? "text-white" : "text-visory-navy"}`}>{emps.length}</p>
                      )}
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

          {filteredEmployees.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{activeGrid === "box1" ? "Talent tiers" : "Culture tiers"}</span>
                <span>{filteredEmployees.length} people</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                {(["top", "medium", "low"] as Tier[]).map((tier) => {
                  const pct = (tierCounts[tier] / filteredEmployees.length) * 100;
                  const color = tier === "top" ? "bg-green-500" : tier === "medium" ? "bg-amber-400" : "bg-red-400";
                  return pct > 0 ? <div key={tier} className={color} style={{ width: `${pct}%` }} title={`${tier}: ${tierCounts[tier]}`} /> : null;
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-xs">
                {(["top", "medium", "low"] as Tier[]).map((tier) => (
                  <span key={tier} className="flex items-center gap-1.5 text-gray-600">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${tier === "top" ? "bg-green-500" : tier === "medium" ? "bg-amber-400" : "bg-red-400"}`} />
                    <span className="capitalize font-medium text-visory-navy">{tier}</span>
                    {tierCounts[tier]} ({Math.round((tierCounts[tier] / filteredEmployees.length) * 100)}%)
                    <span className="text-gray-400">· {(activeGrid === "box1" ? BOX1_TIERS : BOX2_TIERS)[tier].join(", ")}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {filteredEmployees.length === 0 && (
            <p className="mt-4 text-center text-sm text-gray-500">
              {placedEmployees.length === 0 ? "No submitted assessments for this period." : "No employees match the selected filters."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Key Insights with Trend */}
      {currentInsights && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Key Insights</h2>
              {viewMode === "single" && prevInsights && prevCycleLabel && (
                <span className="text-xs text-gray-500">
                  vs. {formatCyclePeriod(prevCycleLabel.month, prevCycleLabel.year)}
                </span>
              )}
              {viewMode === "range" && (
                <Badge className="bg-visory-light text-visory-dark border-visory/20 text-xs">
                  Averaged across {rangeAssessments.length} months
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <InsightCard
                label="Talent Density"
                value={`${currentInsights.avgTD.toFixed(1)}/9`}
                color={currentInsights.avgTD >= 6 ? "text-green-700" : "text-orange-600"}
                prev={prevInsights?.avgTD}
                current={currentInsights.avgTD}
                showTrend={viewMode === "single"}
              />
              <InsightCard
                label="Cultural Momentum"
                value={`${currentInsights.avgCM.toFixed(1)}/9`}
                color={currentInsights.avgCM >= 6 ? "text-green-700" : "text-orange-600"}
                prev={prevInsights?.avgCM}
                current={currentInsights.avgCM}
                showTrend={viewMode === "single"}
              />
              <InsightCard
                label="Avg Performance"
                value={currentInsights.avgPerf.toFixed(1)}
                color="text-visory-navy"
                prev={prevInsights?.avgPerf}
                current={currentInsights.avgPerf}
                showTrend={viewMode === "single"}
              />
              <InsightCard
                label="Avg Growth"
                value={currentInsights.avgGrowth.toFixed(1)}
                color="text-visory-navy"
                prev={prevInsights?.avgGrowth}
                current={currentInsights.avgGrowth}
                showTrend={viewMode === "single"}
              />
              <InsightCard
                label="Top Talent"
                value={`${currentInsights.topTalent}/${currentInsights.total}`}
                color="text-green-700"
                prev={prevInsights ? prevInsights.topTalent / prevInsights.total * 100 : undefined}
                current={currentInsights.topTalent / currentInsights.total * 100}
                showTrend={viewMode === "single"}
                suffix="%"
              />
              <InsightCard
                label="At Risk"
                value={`${currentInsights.atRisk + currentInsights.intervene}`}
                color={currentInsights.atRisk + currentInsights.intervene > 0 ? "text-red-600" : "text-green-700"}
                prev={prevInsights ? prevInsights.atRisk + prevInsights.intervene : undefined}
                current={currentInsights.atRisk + currentInsights.intervene}
                showTrend={viewMode === "single"}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend Table — individual employee movement */}
      {viewMode === "single" && prevPlacedEmployees.length > 0 && filteredEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Month-over-Month Movement</h2>
            <p className="text-xs text-gray-500">
              {selectedCycleLabel && formatCyclePeriod(selectedCycleLabel.month, selectedCycleLabel.year)} vs.{" "}
              {prevCycleLabel && formatCyclePeriod(prevCycleLabel.month, prevCycleLabel.year)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Reports to</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Tier</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Perf</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Growth</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Values</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Engage</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">TD</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">CM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmployees.map((emp) => {
                    const prev = filteredPrev.find((p) => p.id === emp.id);
                    const td = emp.performance * emp.growthReadiness;
                    const cm = emp.valuesAlignment * emp.engagement;
                    const prevTd = prev ? prev.performance * prev.growthReadiness : null;
                    const prevCm = prev ? prev.valuesAlignment * prev.engagement : null;
                    const tiers = activeGrid === "box1" ? BOX1_TIERS : BOX2_TIERS;
                    const tier = getTier(activeGrid === "box1" ? emp.box1Label : emp.box2Label, tiers);
                    const prevTier = prev ? getTier(activeGrid === "box1" ? prev.box1Label : prev.box2Label, tiers) : null;
                    const tierRank: Record<Tier, number> = { low: 0, medium: 1, top: 2 };
                    return (
                      <tr key={emp.id}>
                        <td className="py-2 px-2">
                          <Link href={`/team/${emp.id}`} className="text-sm font-medium text-visory-navy hover:underline">
                            {emp.name}
                          </Link>
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-600">{emp.managerName ?? "—"}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`text-xs font-medium capitalize ${tier === "top" ? "text-green-700" : tier === "medium" ? "text-amber-700" : "text-red-600"}`}>{tier}</span>
                          {prevTier && prevTier !== tier && <TrendDot current={tierRank[tier]} previous={tierRank[prevTier]} />}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-sm">{emp.performance}</span>
                          {prev && <TrendDot current={emp.performance} previous={prev.performance} />}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-sm">{emp.growthReadiness}</span>
                          {prev && <TrendDot current={emp.growthReadiness} previous={prev.growthReadiness} />}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-sm">{emp.valuesAlignment}</span>
                          {prev && <TrendDot current={emp.valuesAlignment} previous={prev.valuesAlignment} />}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-sm">{emp.engagement}</span>
                          {prev && <TrendDot current={emp.engagement} previous={prev.engagement} />}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`text-sm font-bold ${td >= 6 ? "text-green-700" : "text-orange-600"}`}>{td}</span>
                          {prevTd !== null && <TrendDot current={td} previous={prevTd} />}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`text-sm font-bold ${cm >= 6 ? "text-green-700" : "text-orange-600"}`}>{cm}</span>
                          {prevCm !== null && <TrendDot current={cm} previous={prevCm} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rating versus metric results */}
      {viewMode === "single" && filteredEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Rating vs results</h2>
            <p className="text-xs text-gray-500">
              Performance rated Meeting or above while more key metrics were missed than hit. A coaching conversation, or a goal-setting problem.
            </p>
          </CardHeader>
          <CardContent>
            {disconnects.length === 0 ? (
              <p className="text-sm text-gray-500">No disconnects in this period{metricResults.length === 0 ? " (no metric results recorded yet)" : ""}.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {disconnects.map((d) => (
                  <div key={d.employee.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <Link href={`/summary/${d.employee.id}?cycleId=${selectedCycleId}`} className="text-sm font-medium text-visory-navy hover:underline">
                        {d.employee.name}
                      </Link>
                      <p className="text-xs text-gray-500">
                        Rated {d.employee.performance === 3 ? "Exceeding" : "Meeting"} by {d.employee.managerName ?? "manager"} · missed: {d.missedNames.join(", ")}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">{d.missed} missed · {d.hit} hit</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* By manager */}
      {viewMode === "single" && managerRollup.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">By manager</h2>
            <p className="text-xs text-gray-500">Completion, averages and the accountability signals for each manager&apos;s reports</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Manager</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Avg TD</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Avg CM</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">% Top</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase" title="Reviews edited after submission">Edited</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase" title="Ratings changed after reading the self-review">Adjusted</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase" title="Rating above metric results">Disconnects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {managerRollup.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 px-2 font-medium text-visory-navy">{m.name}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={m.submitted === m.total ? "text-green-700" : "text-amber-700"}>{m.submitted}/{m.total}</span>
                      </td>
                      <td className={`py-2 px-2 text-center font-medium ${m.avgTD >= 6 ? "text-green-700" : "text-orange-600"}`}>{m.avgTD.toFixed(1)}</td>
                      <td className={`py-2 px-2 text-center font-medium ${m.avgCM >= 6 ? "text-green-700" : "text-orange-600"}`}>{m.avgCM.toFixed(1)}</td>
                      <td className="py-2 px-2 text-center">{Math.round(m.topPct)}%</td>
                      <td className="py-2 px-2 text-center">{m.edited}</td>
                      <td className="py-2 px-2 text-center">{m.adjusted}</td>
                      <td className={`py-2 px-2 text-center ${m.disconnects > 0 ? "text-amber-700 font-medium" : ""}`}>{m.disconnects}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prescribed Actions */}
      {filteredEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Prescribed Actions</h2>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {filteredEmployees.map((emp) => {
                const label = activeGrid === "box1" ? emp.box1Label : emp.box2Label;
                const action = activeGrid === "box1" ? getBox1Action(label) : getBox2Action(label);
                return (
                  <div key={emp.id} className="py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/team/${emp.id}`} className="text-sm font-medium text-visory-navy hover:text-visory underline-offset-2 hover:underline transition-colors">
                        {emp.name}
                      </Link>
                      <Badge className="bg-visory-light text-visory-dark border-visory/20 text-xs">{label}</Badge>
                      {emp.managerName && <span className="text-xs text-gray-400">reports to {emp.managerName}</span>}
                    </div>
                    <p className="text-sm text-gray-600">{action}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InsightCard({ label, value, color, prev, current, showTrend, suffix = "" }: {
  label: string;
  value: string;
  color: string;
  prev?: number;
  current: number;
  showTrend: boolean;
  suffix?: string;
}) {
  const diff = prev !== undefined ? current - prev : 0;
  const hasTrend = showTrend && prev !== undefined && Math.abs(diff) >= 0.05;
  return (
    <div className="text-center p-3 rounded-lg bg-visory-grey">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {hasTrend && (
        <span className={`text-xs ${diff > 0 ? "text-green-600" : "text-red-500"}`}>
          {diff > 0 ? "↑" : "↓"} {Math.abs(diff).toFixed(1)}{suffix}
        </span>
      )}
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </div>
  );
}

function TrendDot({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff === 0) return null;
  return (
    <span className={`text-xs ml-0.5 ${diff > 0 ? "text-green-600" : "text-red-500"}`}>
      {diff > 0 ? "↑" : "↓"}
    </span>
  );
}
