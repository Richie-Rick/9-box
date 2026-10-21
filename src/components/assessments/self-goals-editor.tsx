"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GoalData {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  templateId?: string | null;
  createdBy?: { id: string; name: string } | null;
}

/**
 * Lets an employee set their own goals as structured records (not free text).
 * Goals are saved immediately to their profile via the goals API.
 */
export function SelfGoalsEditor({ employeeId }: { employeeId: string }) {
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/goals?employeeId=${employeeId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setGoals(data.filter((g: GoalData) => g.status === "ACTIVE"));
      })
      .finally(() => setLoading(false));
  }, [employeeId]);

  async function addGoal() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          title: title.trim(),
          description: description.trim() || null,
          dueDate: due || null,
        }),
      });
      if (res.ok) {
        const goal = await res.json();
        setGoals((prev) => [goal, ...prev]);
        setTitle("");
        setDescription("");
        setDue("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeGoal(goalId: string) {
    const res = await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId, status: "CANCELLED" }),
    });
    if (res.ok) setGoals((prev) => prev.filter((g) => g.id !== goalId));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-3">
        Set your goals for next quarter. These are saved to your profile as tracked goals (not free text).
      </p>

      {!loading && goals.length > 0 && (
        <div className="space-y-2">
          {goals.map((g) => {
            const byEmployee = !g.templateId && (g.createdBy ? g.createdBy.id === employeeId : true);
            return (
              <div key={g.id} className="flex items-start justify-between rounded-lg border border-line px-3 py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">{g.title}</p>
                    {g.templateId ? (
                      <Badge variant="navy" className="text-[11px]">Role-set</Badge>
                    ) : (
                      <Badge variant="slate" className="text-[11px]">
                        {byEmployee ? "Set by employee" : "Set by manager"}
                      </Badge>
                    )}
                  </div>
                  {g.description && <p className="text-xs text-ink-3">{g.description}</p>}
                  {g.dueDate && (
                    <Badge variant="slate" className="text-[11px] mt-1">
                      <span className="mono tnum">Due {new Date(g.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </Badge>
                  )}
                </div>
                {byEmployee && (
                  <Button size="sm" variant="ghost" className="text-[11px] px-2 py-1" onClick={() => removeGoal(g.id)}>
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-line p-3 space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Goal title"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink mono tnum focus:ring-magenta"
          />
          <Button size="sm" onClick={addGoal} disabled={saving || !title.trim()}>
            {saving ? "Adding..." : "Add Goal"}
          </Button>
        </div>
      </div>
    </div>
  );
}
