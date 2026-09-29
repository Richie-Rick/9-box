"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SourceBadge } from "./goals-metrics-card";
import type { EffectiveMetric } from "@/lib/job-roles";

interface MetricResultsEditorProps {
  employeeId: string;
  cycleId: string;
  disabled?: boolean;
  /** Called whenever results change, so a parent can re-evaluate warnings. */
  onChange?: (metrics: EffectiveMetric[]) => void;
}

type Achieved = boolean | null;

/**
 * Records this cycle's actual against each metric (personal and role-set).
 * Either the employee or the manager can fill it in; last write wins and the
 * recorder is shown.
 */
export function MetricResultsEditor({ employeeId, cycleId, disabled, onChange }: MetricResultsEditorProps) {
  const [metrics, setMetrics] = useState<EffectiveMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { actual: string; achieved: Achieved; note: string }>>({});
  const [saving, setSaving] = useState<Record<string, "saving" | "saved" | "error" | undefined>>({});
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/key-metrics?employeeId=${employeeId}&cycleId=${cycleId}`)
      .then((r) => r.json())
      .then((data: EffectiveMetric[]) => {
        if (cancelled || !Array.isArray(data)) return;
        setMetrics(data);
        const initial: typeof drafts = {};
        for (const m of data) {
          initial[m.id] = { actual: m.result?.actual ?? "", achieved: m.result?.achieved ?? null, note: m.result?.note ?? "" };
        }
        setDrafts(initial);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, cycleId]);

  async function persist(metric: EffectiveMetric, draft: { actual: string; achieved: Achieved; note: string }) {
    if (!draft.actual.trim()) return;
    setSaving((s) => ({ ...s, [metric.id]: "saving" }));
    try {
      const res = await fetch("/api/key-metrics/results", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          cycleId,
          keyMetricId: metric.keyMetricId,
          metricTemplateId: metric.metricTemplateId,
          actual: draft.actual,
          achieved: draft.achieved,
          note: draft.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaving((s) => ({ ...s, [metric.id]: "error" }));
        return;
      }
      setSaving((s) => ({ ...s, [metric.id]: "saved" }));
      setMetrics((prev) => {
        const next = prev.map((m) => (m.id === metric.id ? { ...m, result: data, latestResult: data } : m));
        onChange?.(next);
        return next;
      });
    } catch {
      setSaving((s) => ({ ...s, [metric.id]: "error" }));
    }
  }

  function update(metric: EffectiveMetric, patch: Partial<{ actual: string; achieved: Achieved; note: string }>, immediate = false) {
    const next = { ...drafts[metric.id], ...patch };
    setDrafts((d) => ({ ...d, [metric.id]: next }));
    window.clearTimeout(timers.current[metric.id]);
    timers.current[metric.id] = window.setTimeout(() => persist(metric, next), immediate ? 0 : 800);
  }

  if (loading) return <p className="text-sm text-gray-400">Loading metrics...</p>;
  if (metrics.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No key metrics are set for this person yet, so there is nothing to record. You can skip this step.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {metrics.map((m) => {
        const draft = drafts[m.id] ?? { actual: "", achieved: null, note: "" };
        const state = saving[m.id];
        return (
          <div key={m.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-visory-navy">{m.name}</p>
                <SourceBadge source={m.source} />
              </div>
              <p className="text-xs text-gray-500">
                Target <span className="font-medium text-gray-700">{m.target}{m.unit ? ` ${m.unit}` : ""}</span>
                {state === "saving" && <span className="ml-2 text-gray-400">Saving...</span>}
                {state === "saved" && <span className="ml-2 text-green-600">Saved</span>}
                {state === "error" && <span className="ml-2 text-red-600">Not saved</span>}
              </p>
            </div>
            {m.notes && <p className="text-xs text-gray-500 mt-1">{m.notes}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <input
                type="text"
                value={draft.actual}
                disabled={disabled}
                onChange={(e) => update(m, { actual: e.target.value })}
                placeholder={`Actual${m.unit ? ` (${m.unit})` : ""}`}
                className="w-36 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-visory disabled:bg-gray-50"
              />
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
                {([
                  [true, "Hit"],
                  [false, "Missed"],
                  [null, "Unsure"],
                ] as [Achieved, string][]).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    onClick={() => update(m, { achieved: value }, true)}
                    className={cn(
                      "px-3 py-1.5",
                      draft.achieved === value
                        ? value === true
                          ? "bg-green-600 text-white"
                          : value === false
                            ? "bg-red-600 text-white"
                            : "bg-gray-500 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={draft.note}
                disabled={disabled}
                onChange={(e) => update(m, { note: e.target.value })}
                placeholder="Note (optional)"
                className="flex-1 min-w-[160px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-visory disabled:bg-gray-50"
              />
            </div>
            {m.result && (
              <p className="text-[11px] text-gray-400 mt-1">
                Recorded by {m.result.recordedBy.name}
                {m.result.achieved !== null && (
                  <Badge className={cn("ml-2 text-[10px]", m.result.achieved ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300")}>
                    {m.result.achieved ? "Hit" : "Missed"}
                  </Badge>
                )}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
