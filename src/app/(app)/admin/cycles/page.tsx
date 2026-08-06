"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { PageHeader } from "@/components/ui/page-header";
import { formatCyclePeriod, getCurrentPeriod } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { CycleData } from "@/types";

interface CycleAssessment {
  id: string;
  employee: { id: string; name: string; email: string };
  manager: { id: string; name: string } | null;
  selfStatus: "pending" | "submitted";
  managerStatus: "pending" | "submitted";
  overallStatus: "pending" | "in_progress" | "ready_to_send" | "results_sent";
  createdAt: string;
  submittedAt: string | null;
  resultsSentAt: string | null;
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

const QUARTERS = [
  { value: 1, label: "Q1 (Jan–Mar)" },
  { value: 2, label: "Q2 (Apr–Jun)" },
  { value: 3, label: "Q3 (Jul–Sep)" },
  { value: 4, label: "Q4 (Oct–Dec)" },
];

const ADMIN_COLUMNS: { key: CycleAssessment["overallStatus"]; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready_to_send", label: "Ready to Send" },
  { key: "results_sent", label: "Results Sent" },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const SELECT_CLASS =
  "rounded-lg border border-line-2 bg-paper-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-magenta focus:ring-2 focus:ring-magenta/20";

export default function AdminCyclesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [creating, setCreating] = useState(false);
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [cycleDetail, setCycleDetail] = useState<CycleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingCycleId, setDeletingCycleId] = useState<string | null>(null);

  // Create cycle form
  const { quarter: curQuarter, year: curYear } = getCurrentPeriod();
  const [selectedQuarter, setSelectedQuarter] = useState(curQuarter);
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
      body: JSON.stringify({ quarter: selectedQuarter, year: selectedYear }),
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

  async function toggleExpand(cycleId: string) {
    if (expandedCycleId === cycleId) {
      setExpandedCycleId(null);
      setCycleDetail(null);
      return;
    }
    setExpandedCycleId(cycleId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}`);
      const data = await res.json();
      setCycleDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  }

  // Generate year options: current year -1 to +1
  const yearOptions = [curYear - 1, curYear, curYear + 1];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={<>Assessment <em>cycles.</em></>}
        sub="Manage quarterly assessment cycles."
        actions={
          <>
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {QUARTERS.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Button onClick={createCycle} disabled={creating} size="sm">
              {creating ? "Creating..." : "Create Cycle"}
            </Button>
          </>
        }
      />

      {createError && (
        <div className="rounded-lg bg-magenta-3 border border-magenta/25 p-3 text-sm text-magenta-2">
          {createError}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div
          className="dt-head grid items-center gap-3 px-4 py-2.5"
          style={{ gridTemplateColumns: "1fr 140px 120px auto" }}
        >
          <span>Period</span>
          <span>Created</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {cycles.map((cycle) => (
          <div key={cycle.id}>
            <div
              className="dt-row grid items-center gap-3 px-4 py-3"
              style={{ gridTemplateColumns: "1fr 140px 120px auto" }}
            >
              <button
                onClick={() => toggleExpand(cycle.id)}
                className="flex items-center gap-2.5 text-left"
              >
                <ChevronRight
                  size={16}
                  strokeWidth={1.6}
                  className={`text-ink-3 transition-transform ${expandedCycleId === cycle.id ? "rotate-90" : ""}`}
                />
                <span className="text-sm font-medium text-ink">{formatCyclePeriod(cycle)}</span>
              </button>
              <span className="mono tnum text-xs text-ink-3">{formatDate(cycle.createdAt)}</span>
              <div>
                <Badge variant={cycle.status === "OPEN" ? "success" : "slate"}>{cycle.status}</Badge>
              </div>
              <div className="flex items-center justify-end gap-3">
                <Toggle
                  checked={cycle.status === "OPEN"}
                  onChange={() => toggleCycle(cycle.id, cycle.status)}
                  label={cycle.status === "OPEN" ? "Close cycle" : "Reopen cycle"}
                />
                <Button
                  size="sm"
                  variant="magenta"
                  onClick={() => deleteCycle(cycle.id)}
                  disabled={deletingCycleId === cycle.id}
                >
                  {deletingCycleId === cycle.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>

            {expandedCycleId === cycle.id && (
              <div className="border-t border-line bg-paper-2 px-4 pb-4">
                {loadingDetail ? (
                  <p className="text-center py-4 text-sm text-ink-3">Loading...</p>
                ) : cycleDetail ? (
                  <div className="space-y-4 pt-4">
                    {/* Stats summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="text-center p-2 rounded-lg border border-line bg-paper">
                        <p className="mono tnum text-lg text-ink">{cycleDetail.stats.total}</p>
                        <p className="tiny text-ink-3">Total</p>
                      </div>
                      <div className="text-center p-2 rounded-lg border border-line bg-paper">
                        <p className="mono tnum text-lg text-ink-2">{cycleDetail.stats.pending}</p>
                        <p className="tiny text-ink-3">Pending</p>
                      </div>
                      <div className="text-center p-2 rounded-lg border border-line bg-paper">
                        <p className="mono tnum text-lg text-amber">{cycleDetail.stats.inProgress}</p>
                        <p className="tiny text-ink-3">In Progress</p>
                      </div>
                      <div className="text-center p-2 rounded-lg border border-line bg-paper">
                        <p className="mono tnum text-lg text-navy">{cycleDetail.stats.readyToSend}</p>
                        <p className="tiny text-ink-3">Ready to Send</p>
                      </div>
                      <div className="text-center p-2 rounded-lg border border-line bg-paper">
                        <p className="mono tnum text-lg text-success">{cycleDetail.stats.resultsSent}</p>
                        <p className="tiny text-ink-3">Results Sent</p>
                      </div>
                    </div>

                    {/* Assessment kanban by status */}
                    {cycleDetail.assessments.length === 0 ? (
                      <p className="text-center text-sm text-ink-3 py-2">
                        No assessments created for this cycle.
                      </p>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {ADMIN_COLUMNS.map((col) => {
                          const items = cycleDetail.assessments.filter((a) => a.overallStatus === col.key);
                          return (
                            <div key={col.key} className="flex-shrink-0 w-56">
                              <div className="flex items-center justify-between mb-2 px-1">
                                <span className="eyebrow">{col.label}</span>
                                <Badge variant="slate">{items.length}</Badge>
                              </div>
                              <div className="space-y-2 rounded-lg border border-line bg-paper p-2 min-h-[80px] max-h-[26rem] overflow-y-auto">
                                {items.map((a) => (
                                  <div key={a.id} className="rounded-md border border-line bg-paper-2 p-2.5">
                                    <button
                                      onClick={() => router.push(`/summary/${a.employee.id}?cycleId=${cycle.id}`)}
                                      className="text-xs font-medium text-ink hover:text-magenta text-left"
                                    >
                                      {a.employee.name}
                                    </button>
                                    <p className="tiny text-ink-3">Mgr: {a.manager?.name ?? "—"}</p>
                                    <div className="flex items-center gap-2.5 mt-1 tiny">
                                      <span className={a.selfStatus === "submitted" ? "text-success" : "text-ink-4"} title="Self">● Self</span>
                                      <span className={a.managerStatus === "submitted" ? "text-success" : "text-ink-4"} title="Manager">● Mgr</span>
                                    </div>
                                  </div>
                                ))}
                                {items.length === 0 && <p className="tiny text-ink-3 text-center py-3">None</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}

        {cycles.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-3">
            No cycles yet. Create one to start.
          </p>
        )}
      </Card>
    </div>
  );
}
