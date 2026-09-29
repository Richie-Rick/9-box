"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCyclePeriod, getCurrentPeriod } from "@/lib/utils";
import type { CycleData } from "@/types";
import { StageBadge } from "@/components/ui/stage-badge";
import { StageBoard } from "@/components/team/stage-board";
import type { Stage } from "@/lib/stages";

interface CycleAssessment {
  id: string;
  employee: { id: string; name: string; email: string };
  manager: { id: string; name: string };
  selfStatus: "pending" | "submitted";
  managerStatus: "pending" | "submitted";
  stage: Stage;
  createdAt: string;
  submittedAt: string | null;
  sharedAt: string | null;
  oneOnOneCompletedAt: string | null;
}

interface CycleDetail {
  cycle: CycleData;
  assessments: CycleAssessment[];
  stats: {
    total: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
    shared: number;
    meetingDone: number;
  };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  const [detailView, setDetailView] = useState<"table" | "board">("table");

  // Create cycle form
  const { month: curMonth, year: curYear } = getCurrentPeriod();
  const [selectedMonth, setSelectedMonth] = useState(curMonth);
  const [selectedYear, setSelectedYear] = useState(curYear);
  const [createError, setCreateError] = useState("");
  const [dueDates, setDueDates] = useState<{ self: string; manager: string; meeting: string } | null>(null);
  const [sendEmails, setSendEmails] = useState(true);
  const [reminderState, setReminderState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [reminderSummary, setReminderSummary] = useState("");

  const toInputDate = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const effectiveDueDates = dueDates ?? {
    self: toInputDate(selectedYear, selectedMonth, 7),
    manager: toInputDate(selectedYear, selectedMonth, 14),
    meeting: toInputDate(selectedYear, selectedMonth, 21),
  };

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
      body: JSON.stringify({
        month: selectedMonth,
        year: selectedYear,
        selfDueAt: `${effectiveDueDates.self}T17:00:00`,
        managerDueAt: `${effectiveDueDates.manager}T17:00:00`,
        meetingDueAt: `${effectiveDueDates.meeting}T17:00:00`,
        sendEmails,
      }),
    });
    if (res.ok) {
      setDueDates(null);
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

  async function sendRemindersNow() {
    setReminderState("sending");
    setReminderSummary("");
    try {
      const res = await fetch("/api/cron/reminders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setReminderState("error");
        setReminderSummary(data.error || "Could not send reminders");
        return;
      }
      const totals = (data.cycles as { selfReminders: number; managerReminders: number; shareReminders: number; meetingReminders: number }[]).reduce(
        (acc, c) => acc + c.selfReminders + c.managerReminders + c.shareReminders + c.meetingReminders,
        0
      );
      setReminderState("done");
      setReminderSummary(`${totals} reminder${totals === 1 ? "" : "s"} sent. Each person gets at most one per kind per day.`);
    } catch {
      setReminderState("error");
      setReminderSummary("Could not reach the server");
    }
  }

  async function updateDueDate(cycleId: string, field: "selfDueAt" | "managerDueAt" | "meetingDueAt", value: string) {
    await fetch("/api/cycles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cycleId, [field]: value ? `${value}T17:00:00` : null }),
    });
    loadCycles();
  }

  const dateInputValue = (value: string | null | undefined) => (value ? value.slice(0, 10) : "");

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
            onChange={(e) => { setSelectedMonth(Number(e.target.value)); setDueDates(null); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-visory"
          >
            {MONTHS.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(Number(e.target.value)); setDueDates(null); }}
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

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                ["self", "Self-assessments due"],
                ["manager", "Manager reviews due"],
                ["meeting", "1:1s due"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input
                    type="date"
                    value={effectiveDueDates[key]}
                    onChange={(e) => setDueDates({ ...effectiveDueDates, [key]: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-visory"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)} className="rounded border-gray-300 text-visory focus:ring-visory" />
                Email everyone when the new cycle opens
              </label>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={sendRemindersNow} disabled={reminderState === "sending"}>
                  {reminderState === "sending" ? "Sending..." : "Send reminders now"}
                </Button>
                {reminderSummary && (
                  <span className={`text-xs ${reminderState === "error" ? "text-red-600" : "text-green-700"}`}>{reminderSummary}</span>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Reminders also go out automatically on Sunday and Monday mornings to anyone behind, escalating to the manager&apos;s manager three days after a due date.
          </p>
        </CardContent>
      </Card>

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
                <div className="hidden lg:flex items-center gap-3 text-xs text-gray-500">
                  {([
                    ["selfDueAt", "Self"],
                    ["managerDueAt", "Manager"],
                    ["meetingDueAt", "1:1"],
                  ] as const).map(([field, label]) => (
                    <label key={field} className="flex items-center gap-1">
                      {label}
                      <input
                        type="date"
                        value={dateInputValue(cycle[field])}
                        onChange={(e) => updateDueDate(cycle.id, field, e.target.value)}
                        className="rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                      />
                    </label>
                  ))}
                </div>
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
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        <div className="text-center p-2 rounded-lg bg-visory-grey">
                          <p className="text-lg font-bold text-visory-navy">{cycleDetail.stats.total}</p>
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-gray-50">
                          <p className="text-lg font-bold text-gray-600">{cycleDetail.stats.notStarted}</p>
                          <p className="text-xs text-gray-500">Not started</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-amber-50">
                          <p className="text-lg font-bold text-amber-600">{cycleDetail.stats.inProgress}</p>
                          <p className="text-xs text-gray-500">In progress</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-blue-50">
                          <p className="text-lg font-bold text-blue-600">{cycleDetail.stats.submitted}</p>
                          <p className="text-xs text-gray-500">Submitted</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-visory-light">
                          <p className="text-lg font-bold text-visory-dark">{cycleDetail.stats.shared}</p>
                          <p className="text-xs text-gray-500">Shared</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-green-50">
                          <p className="text-lg font-bold text-green-600">{cycleDetail.stats.meetingDone}</p>
                          <p className="text-xs text-gray-500">Meeting done</p>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
                          <button onClick={() => setDetailView("table")} className={`px-3 py-1.5 ${detailView === "table" ? "bg-visory-navy text-white" : "bg-white text-visory-navy hover:bg-gray-50"}`}>Table</button>
                          <button onClick={() => setDetailView("board")} className={`px-3 py-1.5 ${detailView === "board" ? "bg-visory-navy text-white" : "bg-white text-visory-navy hover:bg-gray-50"}`}>Board</button>
                        </div>
                      </div>

                      {detailView === "board" && (
                        <StageBoard
                          onOpen={(card) => router.push(`/summary/${card.id}?cycleId=${cycle.id}`)}
                          cards={cycleDetail.assessments.map((a) => ({
                            id: a.employee.id,
                            name: a.employee.name,
                            subtitle: `Manager: ${a.manager.name}`,
                            stage: a.stage,
                            selfStatus: a.selfStatus === "submitted" ? "submitted" : "not_started",
                            managerStatus: a.managerStatus === "submitted" ? "submitted" : "not_started",
                          }))}
                        />
                      )}

                      {/* Assessment table */}
                      {detailView === "table" && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Employee</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Manager</th>
                              <th className="text-center py-2 px-2 font-medium text-gray-500">Self</th>
                              <th className="text-center py-2 px-2 font-medium text-gray-500">Manager</th>
                              <th className="text-center py-2 px-2 font-medium text-gray-500">Stage</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Shared</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">1:1</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {cycleDetail.assessments.map((a) => (
                              <tr key={a.id}>
                                <td className="py-2 px-2 text-visory-navy">{a.employee.name}</td>
                                <td className="py-2 px-2 text-gray-600">{a.manager.name}</td>
                                <td className="py-2 px-2 text-center">
                                  {a.selfStatus === "submitted" ? (
                                    <span className="text-green-600">Done</span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  {a.managerStatus === "submitted" ? (
                                    <span className="text-green-600">Done</span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <StageBadge stage={a.stage} />
                                </td>
                                <td className="py-2 px-2 text-gray-500 text-xs">{formatDate(a.sharedAt)}</td>
                                <td className="py-2 px-2 text-gray-500 text-xs">{formatDate(a.oneOnOneCompletedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      )}

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
