"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GoalUpdateData {
  id: string;
  status: "ON_TRACK" | "OFF_TRACK" | "DONE";
  note: string | null;
  author: { id: string; name: string };
}

export interface GoalData {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: "PROPOSED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  templateId?: string | null;
  proposedBy?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string };
  updates?: GoalUpdateData[];
}

export interface MetricData {
  id: string;
  name: string;
  target: string;
  unit: string | null;
  notes: string | null;
  source?: "personal" | "role";
  latestResult?: { actual: string; achieved: boolean | null } | null;
}

export const UPDATE_STATUS_LABEL: Record<GoalUpdateData["status"], string> = {
  ON_TRACK: "On track",
  OFF_TRACK: "Off track",
  DONE: "Done",
};

export const UPDATE_STATUS_CLASS: Record<GoalUpdateData["status"], string> = {
  ON_TRACK: "bg-green-100 text-green-800 border-green-300",
  OFF_TRACK: "bg-amber-100 text-amber-800 border-amber-300",
  DONE: "bg-blue-100 text-blue-800 border-blue-300",
};

export function SourceBadge({ source }: { source?: "personal" | "role" }) {
  return source === "role" ? (
    <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">Role-set</Badge>
  ) : (
    <Badge className="bg-gray-100 text-gray-600 border-gray-300 text-[10px]">Personal</Badge>
  );
}

async function fetchList<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || !Array.isArray(data)) {
    throw new Error(typeof data?.error === "string" ? data.error : "Request failed");
  }
  return data as T[];
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

interface GoalsMetricsCardProps {
  employeeId: string;
  /** When given, goal status updates for that cycle are shown. */
  cycleId?: string | null;
  variant?: "dashboard" | "form" | "compact";
  /** The viewer is the employee's manager (or leadership) and can add items. */
  canEdit?: boolean;
  /** The viewer is the employee and can propose goals. */
  isSelf?: boolean;
  title?: string;
  className?: string;
}

export function GoalsMetricsCard({
  employeeId,
  cycleId,
  variant = "form",
  canEdit = false,
  isSelf = false,
  title = "Goals & Key Metrics",
  className,
}: GoalsMetricsCardProps) {
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showMetricForm, setShowMetricForm] = useState(false);
  const [goalDraft, setGoalDraft] = useState({ title: "", description: "", dueDate: "" });
  const [metricDraft, setMetricDraft] = useState({ name: "", target: "", unit: "" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const goalsUrl = `/api/goals?employeeId=${employeeId}${cycleId ? `&cycleId=${cycleId}` : ""}`;
    Promise.all([
      fetchList<GoalData>(goalsUrl),
      fetchList<MetricData>(`/api/key-metrics?employeeId=${employeeId}`),
    ])
      .then(([g, m]) => {
        if (cancelled) return;
        setGoals(g);
        setMetrics(m);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, cycleId, reloadKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  async function post(url: string, method: string, body: Record<string, unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Something went wrong");
        return false;
      }
      return true;
    } catch {
      setActionError("Could not reach the server");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addGoal() {
    if (!goalDraft.title.trim()) return;
    const ok = await post("/api/goals", "POST", {
      employeeId,
      title: goalDraft.title,
      description: goalDraft.description || null,
      dueDate: goalDraft.dueDate || null,
    });
    if (ok) {
      setGoalDraft({ title: "", description: "", dueDate: "" });
      setShowGoalForm(false);
      reload();
    }
  }

  async function addMetric() {
    if (!metricDraft.name.trim() || !metricDraft.target.trim()) return;
    const ok = await post("/api/key-metrics", "POST", {
      employeeId,
      name: metricDraft.name,
      target: metricDraft.target,
      unit: metricDraft.unit || null,
    });
    if (ok) {
      setMetricDraft({ name: "", target: "", unit: "" });
      setShowMetricForm(false);
      reload();
    }
  }

  async function setGoalStatus(goalId: string, status: GoalData["status"]) {
    const ok = await post("/api/goals", "PATCH", { goalId, status });
    if (ok) reload();
  }

  const proposed = goals.filter((g) => g.status === "PROPOSED");
  const active = goals.filter((g) => g.status === "ACTIVE");
  const compact = variant === "compact";
  const total = active.length + metrics.length;

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white shadow-sm", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h2 className={cn("font-semibold text-visory-navy", compact ? "text-sm" : "text-base")}>{title}</h2>
          {!loading && !error && (
            <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">{total}</Badge>
          )}
        </div>
        {(canEdit || isSelf) && !compact && (
          <div className="flex gap-2">
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => { setShowMetricForm((v) => !v); setShowGoalForm(false); }}>
                {showMetricForm ? "Cancel" : "Add metric"}
              </Button>
            )}
            <Button size="sm" variant={canEdit ? "primary" : "secondary"} onClick={() => { setShowGoalForm((v) => !v); setShowMetricForm(false); }}>
              {showGoalForm ? "Cancel" : canEdit ? "Add goal" : "Propose a goal"}
            </Button>
          </div>
        )}
      </div>

      <div className={cn("px-4 py-3 space-y-4", compact && "text-sm")}>
        {actionError && <p className="text-sm text-red-700">{actionError}</p>}

        {showGoalForm && (
          <div className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50">
            <input
              type="text"
              value={goalDraft.title}
              onChange={(e) => setGoalDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder={canEdit ? "Goal title" : "What do you want to achieve?"}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
            />
            <textarea
              value={goalDraft.description}
              onChange={(e) => setGoalDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Due</label>
              <input
                type="date"
                value={goalDraft.dueDate}
                onChange={(e) => setGoalDraft((d) => ({ ...d, dueDate: e.target.value }))}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
              />
              <Button size="sm" onClick={addGoal} disabled={busy || !goalDraft.title.trim()} className="ml-auto">
                {busy ? "Saving..." : canEdit ? "Save goal" : "Send proposal"}
              </Button>
            </div>
            {!canEdit && <p className="text-xs text-gray-500">Your manager will see this proposal and can accept it.</p>}
          </div>
        )}

        {showMetricForm && (
          <div className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={metricDraft.name}
                onChange={(e) => setMetricDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Metric (e.g. Utilisation)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
              />
              <input
                type="text"
                value={metricDraft.target}
                onChange={(e) => setMetricDraft((d) => ({ ...d, target: e.target.value }))}
                placeholder="Target (e.g. 85)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
              />
              <input
                type="text"
                value={metricDraft.unit}
                onChange={(e) => setMetricDraft((d) => ({ ...d, unit: e.target.value }))}
                placeholder="Unit (optional)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={addMetric} disabled={busy || !metricDraft.name.trim() || !metricDraft.target.trim()}>
                {busy ? "Saving..." : "Save metric"}
              </Button>
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-gray-400">Loading goals and metrics...</p>}
        {error && (
          <div className="flex items-center justify-between gap-3 text-sm text-red-700">
            <span>Couldn&apos;t load goals and metrics: {error}</span>
            <button type="button" onClick={reload} className="underline underline-offset-2">Retry</button>
          </div>
        )}

        {!loading && !error && total === 0 && proposed.length === 0 && (
          <p className="text-sm text-gray-500">
            {isSelf
              ? "No goals or metrics yet. Your manager sets these, or propose a goal above."
              : canEdit
                ? "No goals or metrics yet. Add the first one above."
                : "No goals or metrics set yet."}
          </p>
        )}

        {proposed.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Proposed goals</p>
            <ul className="space-y-2">
              {proposed.map((g) => (
                <li key={g.id} className="rounded-lg border border-dashed border-gray-300 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-visory-navy">{g.title}</p>
                      {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        Proposed by {g.proposedBy?.name ?? "employee"}{g.dueDate ? ` · due ${formatDate(g.dueDate)}` : ""}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" onClick={() => setGoalStatus(g.id, "ACTIVE")} disabled={busy}>Accept</Button>
                        <Button size="sm" variant="ghost" onClick={() => setGoalStatus(g.id, "CANCELLED")} disabled={busy}>Decline</Button>
                      </div>
                    ) : isSelf ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Awaiting manager</Badge>
                        <Button size="sm" variant="ghost" onClick={() => setGoalStatus(g.id, "CANCELLED")} disabled={busy}>Withdraw</Button>
                      </div>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Proposed</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {active.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Active goals</p>
            <ul className="space-y-2">
              {active.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-visory-navy">{g.title}</p>
                      <SourceBadge source={g.templateId ? "role" : "personal"} />
                    </div>
                    {!compact && g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                    {g.dueDate && <p className="text-xs text-gray-400 mt-0.5">Due {formatDate(g.dueDate)}</p>}
                  </div>
                  {g.updates && g.updates.length > 0 && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {g.updates.map((u) => (
                        <span key={u.id} className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400">{u.author.name.split(" ")[0]}</span>
                          <Badge className={cn(UPDATE_STATUS_CLASS[u.status], "text-[10px]")}>{UPDATE_STATUS_LABEL[u.status]}</Badge>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {metrics.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Key metrics</p>
            <ul className="divide-y divide-gray-100">
              {metrics.map((m) => (
                <li key={m.id} className="py-1.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-visory-navy truncate">{m.name}</span>
                    <SourceBadge source={m.source ?? "personal"} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-gray-700">
                      Target {m.target}{m.unit ? ` ${m.unit}` : ""}
                    </p>
                    <p className="text-xs text-gray-400">
                      {m.latestResult
                        ? `Latest ${m.latestResult.actual}${m.unit ? ` ${m.unit}` : ""}`
                        : "No result recorded yet"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
