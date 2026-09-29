"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UPDATE_STATUS_CLASS, UPDATE_STATUS_LABEL, type GoalData, type GoalUpdateData } from "./goals-metrics-card";

type UpdateStatus = GoalUpdateData["status"];
const STATUSES: UpdateStatus[] = ["ON_TRACK", "OFF_TRACK", "DONE"];

interface GoalUpdatesEditorProps {
  employeeId: string;
  cycleId: string;
  /** The current user's id, to separate their update from the other side's. */
  authorId: string;
  disabled?: boolean;
}

/**
 * Lets the employee or manager record a status and note against each active
 * goal for the cycle. Saves on change; the other side's update is shown
 * read-only beneath.
 */
export function GoalUpdatesEditor({ employeeId, cycleId, authorId, disabled }: GoalUpdatesEditorProps) {
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/goals?employeeId=${employeeId}&cycleId=${cycleId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: GoalData[] = Array.isArray(data) ? data.filter((g: GoalData) => g.status === "ACTIVE") : [];
        setGoals(list);
        const initialNotes: Record<string, string> = {};
        for (const g of list) {
          const mine = g.updates?.find((u) => u.author.id === authorId);
          if (mine?.note) initialNotes[g.id] = mine.note;
        }
        setNotes(initialNotes);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load goals");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, cycleId, authorId]);

  async function save(goalId: string, status: UpdateStatus, note: string) {
    setSaving((s) => ({ ...s, [goalId]: true }));
    setError(null);
    try {
      const res = await fetch("/api/goals/updates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, cycleId, status, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save goal update");
        return;
      }
      setGoals((prev) =>
        prev.map((g) => {
          if (g.id !== goalId) return g;
          const others = (g.updates ?? []).filter((u) => u.author.id !== authorId);
          return { ...g, updates: [...others, data] };
        })
      );
    } catch {
      setError("Could not reach the server");
    } finally {
      setSaving((s) => ({ ...s, [goalId]: false }));
    }
  }

  function myUpdate(goal: GoalData) {
    return goal.updates?.find((u) => u.author.id === authorId) ?? null;
  }

  function onNoteChange(goal: GoalData, value: string) {
    setNotes((n) => ({ ...n, [goal.id]: value }));
    const mine = myUpdate(goal);
    if (!mine) return; // a note only saves once a status is chosen
    window.clearTimeout(timers.current[goal.id]);
    timers.current[goal.id] = window.setTimeout(() => save(goal.id, mine.status, value), 800);
  }

  if (loading) return <p className="text-sm text-gray-400">Loading goals...</p>;
  if (goals.length === 0) {
    return <p className="text-sm text-gray-500">No active goals to update this month.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-gray-500 uppercase">Progress on this month&apos;s goals</p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {goals.map((goal) => {
        const mine = myUpdate(goal);
        const others = (goal.updates ?? []).filter((u) => u.author.id !== authorId);
        return (
          <div key={goal.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-visory-navy">{goal.title}</p>
                {goal.dueDate && (
                  <p className="text-xs text-gray-400">
                    Due {new Date(goal.dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </p>
                )}
              </div>
              {saving[goal.id] && <span className="text-xs text-gray-400">Saving...</span>}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={disabled}
                  onClick={() => save(goal.id, status, notes[goal.id] ?? "")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    mine?.status === status
                      ? UPDATE_STATUS_CLASS[status]
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50",
                    disabled && "opacity-60"
                  )}
                >
                  {UPDATE_STATUS_LABEL[status]}
                </button>
              ))}
            </div>
            <textarea
              value={notes[goal.id] ?? ""}
              onChange={(e) => onNoteChange(goal, e.target.value)}
              disabled={disabled}
              placeholder={mine ? "Add a note (optional)" : "Choose a status first, then add a note"}
              rows={2}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory disabled:bg-gray-50"
            />
            {others.length > 0 && (
              <div className="mt-2 space-y-1">
                {others.map((u) => (
                  <p key={u.id} className="text-xs text-gray-600 flex items-center gap-2">
                    <span className="text-gray-400">{u.author.name}:</span>
                    <Badge className={cn(UPDATE_STATUS_CLASS[u.status], "text-[10px]")}>{UPDATE_STATUS_LABEL[u.status]}</Badge>
                    {u.note && <span>{u.note}</span>}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
