"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRatingLabel, getRatingColor, getGrowthReadinessLabel, formatCyclePeriod, getRoleDisplayName } from "@/lib/utils";
import { getValuesAlignment } from "@/lib/nine-box";

interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  team: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  manager: { id: string; name: string } | null;
}

interface AssessmentHistory {
  id: string;
  performance: number | null;
  growthReadiness: number | null;
  engagement: number | null;
  valCustomerFirst: number | null;
  valStepIntoArena: number | null;
  valFlockToProblems: number | null;
  valGiveEnergy: number | null;
  submittedAt: string | null;
  sharedAt: string | null;
  cycle: { id: string; month: number; year: number };
}

interface GoalData {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  createdBy: { id: string; name: string };
}

interface KeyMetricData {
  id: string;
  name: string;
  target: string;
  unit: string | null;
  notes: string | null;
  createdBy: { id: string; name: string };
}

export default function EmployeeProfilePage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [assessments, setAssessments] = useState<AssessmentHistory[]>([]);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [metrics, setMetrics] = useState<KeyMetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDesc, setNewGoalDesc] = useState("");
  const [newGoalDue, setNewGoalDue] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricTarget, setNewMetricTarget] = useState("");
  const [newMetricUnit, setNewMetricUnit] = useState("");
  const [newMetricNotes, setNewMetricNotes] = useState("");
  const [showMetricForm, setShowMetricForm] = useState(false);
  const [savingMetric, setSavingMetric] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editNotesValue, setEditNotesValue] = useState("");

  const role = session?.user?.role;
  const isLeadership = role === "LEADERSHIP" || role === "ADMIN";

  useEffect(() => {
    async function loadData() {
      try {
        const empRes = await fetch(`/api/employees/${employeeId}`);
        if (!empRes.ok) {
          const errData = await empRes.json().catch(() => ({}));
          setError(errData.error || `Error ${empRes.status}: ${empRes.statusText}`);
          setLoading(false);
          return;
        }
        const empData = await empRes.json();
        setEmployee(empData.employee);
        setAssessments(empData.assessments || []);

        const [goalsData, metricsData] = await Promise.all([
          fetch(`/api/goals?employeeId=${employeeId}`).then((r) => r.ok ? r.json() : []),
          fetch(`/api/key-metrics?employeeId=${employeeId}`).then((r) => r.ok ? r.json() : []),
        ]);
        setGoals(Array.isArray(goalsData) ? goalsData : []);
        setMetrics(Array.isArray(metricsData) ? metricsData : []);
      } catch {
        setError("Failed to load employee data");
      }
      setLoading(false);
    }
    loadData();
  }, [employeeId]);

  async function handleAddGoal() {
    if (!newGoalTitle.trim()) return;
    setSavingGoal(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          title: newGoalTitle.trim(),
          description: newGoalDesc.trim() || null,
          dueDate: newGoalDue || null,
        }),
      });
      if (res.ok) {
        const goal = await res.json();
        setGoals((prev) => [goal, ...prev]);
        setNewGoalTitle("");
        setNewGoalDesc("");
        setNewGoalDue("");
        setShowGoalForm(false);
      }
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleGoalStatus(goalId: string, status: string) {
    const res = await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId, status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
    }
  }

  async function handleAddMetric() {
    if (!newMetricName.trim() || !newMetricTarget.trim()) return;
    setSavingMetric(true);
    try {
      const res = await fetch("/api/key-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          name: newMetricName.trim(),
          target: newMetricTarget.trim(),
          unit: newMetricUnit.trim() || null,
          notes: newMetricNotes.trim() || null,
        }),
      });
      if (res.ok) {
        const metric = await res.json();
        setMetrics((prev) => [metric, ...prev]);
        setNewMetricName("");
        setNewMetricTarget("");
        setNewMetricUnit("");
        setNewMetricNotes("");
        setShowMetricForm(false);
      }
    } finally {
      setSavingMetric(false);
    }
  }

  async function handleDeleteMetric(metricId: string) {
    const res = await fetch(`/api/key-metrics?metricId=${metricId}`, { method: "DELETE" });
    if (res.ok) {
      setMetrics((prev) => prev.filter((m) => m.id !== metricId));
    }
  }

  async function handleSaveNotes(metricId: string) {
    const res = await fetch("/api/key-metrics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metricId, notes: editNotesValue }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMetrics((prev) => prev.map((m) => (m.id === metricId ? updated : m)));
    }
    setEditingNotes(null);
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;
  if (!employee) return <div className="text-center py-12 text-gray-500">Employee not found.</div>;

  // Only the direct manager (or leadership) can set goals and metrics
  const canEdit = isLeadership || (!!session?.user?.id && employee.manager?.id === session.user.id);
  const proposedGoals = goals.filter((g) => g.status === "PROPOSED");
  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const completedGoals = goals.filter((g) => g.status === "COMPLETED" || g.status === "CANCELLED");

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div>
        <h1 className="text-2xl font-bold text-visory-navy">{employee.name}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {employee.jobTitle && <span className="text-sm text-gray-600">{employee.jobTitle}</span>}
          {employee.jobTitle && employee.team && <span className="text-gray-300">·</span>}
          {employee.team && <span className="text-sm text-gray-600">{employee.team}</span>}
          <Badge className="bg-gray-100 text-gray-700 border-gray-200">{getRoleDisplayName(employee.role)}</Badge>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{employee.email}</p>
      </div>

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Key Metrics</h2>
              <p className="text-xs text-gray-500">Recurring performance targets</p>
            </div>
            {canEdit && !showMetricForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowMetricForm(true)}>
                Add Metric
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showMetricForm && (
            <div className="rounded-lg border border-gray-200 p-4 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newMetricName}
                  onChange={(e) => setNewMetricName(e.target.value)}
                  placeholder="Metric name (e.g., Utilisation)"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
                />
                <input
                  type="text"
                  value={newMetricTarget}
                  onChange={(e) => setNewMetricTarget(e.target.value)}
                  placeholder="Target (e.g., 85%)"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
                />
                <input
                  type="text"
                  value={newMetricUnit}
                  onChange={(e) => setNewMetricUnit(e.target.value)}
                  placeholder="Unit (optional, e.g., %)"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
                />
              </div>
              <textarea
                value={newMetricNotes}
                onChange={(e) => setNewMetricNotes(e.target.value)}
                placeholder="Notes (optional — visible to employee and manager)"
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddMetric} disabled={savingMetric || !newMetricName.trim() || !newMetricTarget.trim()}>
                  {savingMetric ? "Saving..." : "Save Metric"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowMetricForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {metrics.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {metrics.map((metric) => (
                <div key={metric.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-visory-navy">{metric.name}</p>
                      <p className="text-xs text-gray-500">
                        Target: <span className="font-medium">{metric.target}</span>
                        {metric.unit && <span> {metric.unit}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!metric.notes && editingNotes !== metric.id && (
                        <Button size="sm" variant="ghost" onClick={() => { setEditingNotes(metric.id); setEditNotesValue(""); }}>
                          Add Note
                        </Button>
                      )}
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteMetric(metric.id)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  {metric.notes && editingNotes !== metric.id && (
                    <div
                      className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100"
                      onClick={() => { setEditingNotes(metric.id); setEditNotesValue(metric.notes || ""); }}
                    >
                      {metric.notes}
                    </div>
                  )}
                  {editingNotes === metric.id && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editNotesValue}
                        onChange={(e) => setEditNotesValue(e.target.value)}
                        placeholder="Add a note (visible to employee and manager)..."
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveNotes(metric.id)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">No key metrics set yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Goals</h2>
              <p className="text-xs text-gray-500">Time-bound objectives</p>
            </div>
            {canEdit && !showGoalForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowGoalForm(true)}>
                Add Goal
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showGoalForm && (
            <div className="rounded-lg border border-gray-200 p-4 mb-4 space-y-3">
              <input
                type="text"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                placeholder="Goal title"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
              />
              <textarea
                value={newGoalDesc}
                onChange={(e) => setNewGoalDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
              />
              <div>
                <label className="text-xs text-gray-500 block mb-1">Due date (optional)</label>
                <input
                  type="date"
                  value={newGoalDue}
                  onChange={(e) => setNewGoalDue(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddGoal} disabled={savingGoal || !newGoalTitle.trim()}>
                  {savingGoal ? "Saving..." : "Save Goal"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowGoalForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {proposedGoals.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase">Proposed by {employee.name.split(" ")[0]}</p>
              {proposedGoals.map((goal) => (
                <div key={goal.id} className="rounded-lg border border-dashed border-gray-300 p-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-visory-navy">{goal.title}</p>
                    {goal.description && <p className="text-sm text-gray-600 mt-0.5">{goal.description}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" onClick={() => handleGoalStatus(goal.id, "ACTIVE")}>Accept</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleGoalStatus(goal.id, "CANCELLED")}>Decline</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeGoals.length > 0 && (
            <div className="space-y-3">
              {activeGoals.map((goal) => (
                <div key={goal.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-visory-navy">{goal.title}</p>
                      {goal.description && <p className="text-sm text-gray-600 mt-0.5">{goal.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        {goal.dueDate && (
                          <span className="text-xs text-gray-500">
                            Due: {new Date(goal.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => handleGoalStatus(goal.id, "COMPLETED")}>
                          Complete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleGoalStatus(goal.id, "CANCELLED")}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeGoals.length === 0 && !showGoalForm && (
            <p className="text-sm text-gray-400 text-center py-2">No active goals.</p>
          )}

          {completedGoals.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Past Goals</p>
              <div className="space-y-2">
                {completedGoals.map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between py-2 opacity-60">
                    <div>
                      <p className="text-sm text-visory-navy line-through">{goal.title}</p>
                      {goal.dueDate && (
                        <span className="text-xs text-gray-500">
                          Due: {new Date(goal.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <Badge className={goal.status === "COMPLETED" ? "bg-green-100 text-green-800 border-green-300" : "bg-gray-100 text-gray-600 border-gray-300"}>
                      {goal.status === "COMPLETED" ? "Completed" : "Cancelled"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance History */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Performance History</h2>
        </CardHeader>
        <CardContent>
          {assessments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Performance</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Growth</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Values</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">Engagement</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">TD</th>
                    <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">CM</th>
                    <th className="text-right py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assessments.map((a) => {
                    const va = a.valCustomerFirst && a.valStepIntoArena && a.valFlockToProblems && a.valGiveEnergy
                      ? getValuesAlignment(a.valCustomerFirst, a.valStepIntoArena, a.valFlockToProblems, a.valGiveEnergy)
                      : null;
                    const td = a.performance && a.growthReadiness ? a.performance * a.growthReadiness : null;
                    const cm = va && a.engagement ? va * a.engagement : null;

                    return (
                      <tr key={a.id}>
                        <td className="py-2 px-2 font-medium text-visory-navy">
                          {formatCyclePeriod(a.cycle.month, a.cycle.year)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {a.performance ? (
                            <Badge className={getRatingColor(a.performance)}>{getRatingLabel(a.performance)}</Badge>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {a.growthReadiness ? (
                            <Badge className={getRatingColor(a.growthReadiness)}>{getGrowthReadinessLabel(a.growthReadiness)}</Badge>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {va ? (
                            <Badge className={getRatingColor(va)}>{getRatingLabel(va)}</Badge>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {a.engagement ? (
                            <Badge className={getRatingColor(a.engagement)}>{getRatingLabel(a.engagement)}</Badge>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {td !== null ? (
                            <span className={`text-sm font-bold ${td >= 6 ? "text-green-700" : "text-orange-600"}`}>{td}/9</span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {cm !== null ? (
                            <span className={`text-sm font-bold ${cm >= 6 ? "text-green-700" : "text-orange-600"}`}>{cm}/9</span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/summary/${employeeId}?cycleId=${a.cycle.id}`)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No assessment history yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
