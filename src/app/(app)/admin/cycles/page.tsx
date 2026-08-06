"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCyclePeriod, getCurrentPeriod } from "@/lib/utils";
import type { CycleData } from "@/types";

interface CycleAssessment {
  id: string;
  employee: { id: string; name: string; email: string };
  manager: { id: string; name: string };
  selfStatus: "pending" | "submitted";
  managerStatus: "pending" | "submitted";
  overallStatus: "pending" | "in_progress" | "ready_to_send" | "results_sent";
  createdAt: string;
  submittedAt: string | null;
  resultsSentAt: string | null;
  managerUnlockedAt: string | null;
  selfAssessmentId: string | null;
  selfUnlockedAt: string | null;
}

interface CycleDetail {
  cycle: CycleData;
  assessments: CycleAssessment[];
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    readyToSend: number;
    resultsSent: number;
  };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getStatusBadge(status: string) {
  switch (status) {
    case "results_sent":
      return <Badge className="bg-green-100 text-green-800 border-green-300">Results Sent</Badge>;
    case "ready_to_send":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Ready to Send</Badge>;
    case "in_progress":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300">In Progress</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-600 border-gray-300">Pending</Badge>;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminCyclesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [creating, setCreating] = useState(false);
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [cycleDetail, setCycleDetail] = useState<CycleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingCycleId, setDeletingCycleId] = useState<string | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  // Create cycle form
  const { month: curMonth, year: curYear } = getCurrentPeriod();
  const [selectedMonth, setSelectedMonth] = useState(curMonth);
  const [selectedYear, setSelectedYear] = useState(curYear);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    loadCycles();
  }, [session, router]);

  function loadCycles() {
    fetch("/api/cycles").then((r) => r.json()).then(setCycles);
  }

  async function createCycle() {
    setCreating(true);
    setCreateError("");
    const res = await fetch("/api/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: selectedMonth, year: selectedYear }),
    });
    if (res.ok) {
      loadCycles();
    } else {
      const err = await res.json();
      setCreateError(err.error || "Failed to create cycle");
    }
    setCreating(false);
  }

  async function toggleCycle(id: string, currentStatus: string) {
    const newStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";
    await fetch("/api/cycles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    loadCycles();
  }

  async function deleteCycle(id: string) {
    if (!confirm("Delete this cycle and all its assessments? This cannot be undone.")) return;
    setDeletingCycleId(id);
    await fetch("/api/cycles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (expandedCycleId === id) {
      setExpandedCycleId(null);
      setCycleDetail(null);
    }
    setDeletingCycleId(null);
    loadCycles();
  }

  async function loadDetail(cycleId: string) {
    const res = await fetch(`/api/cycles/${cycleId}`);
    const data = await res.json();
    setCycleDetail(data);
  }

  async function toggleExpand(cycleId: string) {
    if (expandedCycleId === cycleId) {
      setExpandedCycleId(null);
      setCycleDetail(null);
      return;
    }
    setExpandedCycleId(cycleId);
    setLoadingDetail(true);
    try {
      await loadDetail(cycleId);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function toggleUnlock(type: "self" | "manager", id: string, currentlyUnlocked: boolean) {
    setUnlockingId(id);
    try {
      await fetch("/api/assessments/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, action: currentlyUnlocked ? "lock" : "unlock" }),
      });
      if (expandedCycleId) await loadDetail(expandedCycleId);
    } finally {
      setUnlockingId(null);
    }
  }

  // Generate year options: current year -1 to +1
  const yearOptions = [curYear - 1, curYear, curYear + 1];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-visory-navy">Assessment Cycles</h1>
          <p className="text-sm text-gray-600 mt-1">Manage monthly assessment cycles</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-visory"
          >
            {MONTHS.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-visory"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button onClick={createCycle} disabled={creating} size="sm">
            {creating ? "Creating..." : "Create Cycle"}
          </Button>
        </div>
      </div>

      {createError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {createError}
        </div>
      )}

      <div className="space-y-4">
        {cycles.map((cycle) => (
          <Card key={cycle.id}>
            <CardContent className="py-0">
              <div className="py-4 flex items-center justify-between">
                <button
                  onClick={() => toggleExpand(cycle.id)}
                  className="flex items-center gap-3 text-left"
                >
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedCycleId === cycle.id ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-visory-navy">
                      {formatCyclePeriod(cycle.month, cycle.year)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Created {formatDate(cycle.createdAt)}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <Badge
                    className={
                      cycle.status === "OPEN"
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-gray-100 text-gray-800 border-gray-300"
                    }
                  >
                    {cycle.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toggleCycle(cycle.id, cycle.status)}
                  >
                    {cycle.status === "OPEN" ? "Close" : "Reopen"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteCycle(cycle.id)}
                    disabled={deletingCycleId === cycle.id}
                  >
                    {deletingCycleId === cycle.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>

              {expandedCycleId === cycle.id && (
                <div className="border-t border-gray-100 pb-4">
                  {loadingDetail ? (
                    <p className="text-center py-4 text-sm text-gray-500">Loading...</p>
                  ) : cycleDetail ? (
                    <div className="space-y-4 pt-4">
                      {/* Stats summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="text-center p-2 rounded-lg bg-visory-grey">
                          <p className="text-lg font-bold text-visory-navy">{cycleDetail.stats.total}</p>
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-gray-50">
                          <p className="text-lg font-bold text-gray-600">{cycleDetail.stats.pending}</p>
                          <p className="text-xs text-gray-500">Pending</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-amber-50">
                          <p className="text-lg font-bold text-amber-600">{cycleDetail.stats.inProgress}</p>
                          <p className="text-xs text-gray-500">In Progress</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-blue-50">
                          <p className="text-lg font-bold text-blue-600">{cycleDetail.stats.readyToSend}</p>
                          <p className="text-xs text-gray-500">Ready to Send</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-green-50">
                          <p className="text-lg font-bold text-green-600">{cycleDetail.stats.resultsSent}</p>
                          <p className="text-xs text-gray-500">Results Sent</p>
                        </div>
                      </div>

                      {/* Assessment table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Employee</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Manager</th>
                              <th className="text-center py-2 px-2 font-medium text-gray-500">Self</th>
                              <th className="text-center py-2 px-2 font-medium text-gray-500">Manager</th>
                              <th className="text-center py-2 px-2 font-medium text-gray-500">Status</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Created</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Sent</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {cycleDetail.assessments.map((a) => (
                              <tr key={a.id}>
                                <td className="py-2 px-2 text-visory-navy">{a.employee.name}</td>
                                <td className="py-2 px-2 text-gray-600">{a.manager.name}</td>
                                <td className="py-2 px-2 text-center">
                                  {a.selfStatus === "submitted" ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-green-600">Done</span>
                                      {a.selfUnlockedAt && (
                                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">Unlocked</Badge>
                                      )}
                                      {a.resultsSentAt && a.selfAssessmentId && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-xs h-auto py-0.5"
                                          onClick={() => toggleUnlock("self", a.selfAssessmentId!, !!a.selfUnlockedAt)}
                                          disabled={unlockingId === a.selfAssessmentId}
                                        >
                                          {a.selfUnlockedAt ? "Lock" : "Unlock"}
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  {a.managerStatus === "submitted" ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-green-600">Done</span>
                                      {a.managerUnlockedAt && (
                                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">Unlocked</Badge>
                                      )}
                                      {a.resultsSentAt && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-xs h-auto py-0.5"
                                          onClick={() => toggleUnlock("manager", a.id, !!a.managerUnlockedAt)}
                                          disabled={unlockingId === a.id}
                                        >
                                          {a.managerUnlockedAt ? "Lock" : "Unlock"}
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  {getStatusBadge(a.overallStatus)}
                                </td>
                                <td className="py-2 px-2 text-gray-500 text-xs">{formatDate(a.createdAt)}</td>
                                <td className="py-2 px-2 text-gray-500 text-xs">{formatDate(a.resultsSentAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {cycleDetail.assessments.length === 0 && (
                        <p className="text-center text-sm text-gray-500 py-2">
                          No assessments created for this cycle.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {cycles.length === 0 && (
          <Card>
            <CardContent>
              <p className="py-4 text-center text-sm text-gray-500">
                No cycles yet. Create one to start.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
