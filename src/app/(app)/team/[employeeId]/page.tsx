"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, Eyebrow } from "@/components/ui/page-header";
import { getRatingLabel, getGrowthReadinessLabel, formatCyclePeriod, getRoleDisplayName } from "@/lib/utils";
import { getValuesAlignment } from "@/lib/nine-box";
import { isManager as checkIsManager } from "@/lib/permissions";
import { TasksPanel } from "@/components/tasks/tasks-panel";
import { PerformancePlanCard } from "@/components/performance/performance-plan-card";

interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  team: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  manager: { id: true; name: string } | null;
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
  resultsSentAt: string | null;
  meetingStatus: string;
  meeting: { id: string } | null;
  cycle: { id: string; month: number | null; quarter: number | null; year: number };
}

interface GoalData {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  templateId?: string | null;
  createdBy: { id: string; name: string };
}

interface KeyMetricData {
  id: string;
  name: string;
  target: string;
  unit: string | null;
  notes: string | null;
  templateId?: string | null;
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
  const [actionError, setActionError] = useState<string | null>(null);

  async function reportFailure(res: Response, fallback: string) {
    const data = await res.json().catch(() => ({}));
    const base = data.error || `${fallback} (error ${res.status})`;
    setActionError(data.detail ? `${base} — ${data.detail}` : base);
  }

  const canEdit = session?.user?.role && checkIsManager(session.user.role as "MANAGER" | "AREA_LEAD" | "LEADERSHIP" | "ADMIN" | "EMPLOYEE");

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
    setActionError(null);
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
      } else {
        await reportFailure(res, "Failed to save goal");
      }
    } catch {
      setActionError("Network error while saving goal");
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleGoalStatus(goalId: string, status: string) {
    setActionError(null);
    const res = await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId, status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
    } else {
      await reportFailure(res, "Failed to update goal");
    }
  }

  async function handleAddMetric() {
    if (!newMetricName.trim() || !newMetricTarget.trim()) return;
    setSavingMetric(true);
    setActionError(null);
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
      } else {
        await reportFailure(res, "Failed to save metric");
      }
    } catch {
      setActionError("Network error while saving metric");
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

  if (loading) return <div className="text-center py-12 muted">Loading...</div>;
  if (error) return <div className="text-center py-12 text-magenta">{error}</div>;
  if (!employee) return <div className="text-center py-12 muted">Employee not found.</div>;

  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const completedGoals = goals.filter((g) => g.status !== "ACTIVE");
  // A 1:1 can be run once the manager marks the meeting as scheduled.
  const scheduledMeeting = canEdit ? assessments.find((a) => a.meetingStatus === "MEETING_SCHEDULED") : undefined;

  // Map a 1–3 rating to a Visory badge variant (3→success, 2→warning, 1→magenta).
  const ratingVariant = (r: number): "success" | "warning" | "magenta" =>
    r >= 3 ? "success" : r >= 2 ? "warning" : "magenta";

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-paper-2 border border-magenta/30 p-3 text-sm text-magenta">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-magenta hover:text-magenta-2 shrink-0">✕</button>
        </div>
      )}
      {/* Profile Header */}
      <PageHeader
        eyebrow="Team member"
        title={<><em>{employee.name}</em></>}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {employee.jobTitle && <span>{employee.jobTitle}</span>}
            {employee.jobTitle && employee.team && <span className="muted-2">·</span>}
            {employee.team && <span>{employee.team}</span>}
            <Badge variant="slate">{getRoleDisplayName(employee.role)}</Badge>
            <span className="muted-2">·</span>
            <span className="mono text-xs">{employee.email}</span>
          </span>
        }
        actions={<Avatar name={employee.name} size="xl" />}
      />

      {/* Scheduled 1:1 meeting */}
      {scheduledMeeting && (
        <Card navy className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Eyebrow className="mb-1">1:1 meeting</Eyebrow>
            <p className="serif text-lg leading-tight">1:1 meeting scheduled</p>
            <p className="text-sm muted">
              <span className="mono tnum">{formatCyclePeriod(scheduledMeeting.cycle)}</span> cycle
            </p>
          </div>
          <Button variant="magenta" onClick={() => window.open(`/meeting/${scheduledMeeting.id}`, "_blank", "noopener")}>
            {scheduledMeeting.meeting ? "Edit Meeting Notes" : "Start Meeting"}
          </Button>
        </Card>
      )}

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <div>
            <Eyebrow className="mb-1">Recurring performance targets</Eyebrow>
            <h2 className="card-title">Key Metrics</h2>
          </div>
          {canEdit && !showMetricForm && (
            <Button size="sm" variant="secondary" onClick={() => setShowMetricForm(true)}>
              Add Metric
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showMetricForm && (
            <div className="rounded-lg border border-line p-4 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newMetricName}
                  onChange={(e) => setNewMetricName(e.target.value)}
                  placeholder="Metric name (e.g., Utilisation)"
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
                />
                <input
                  type="text"
                  value={newMetricTarget}
                  onChange={(e) => setNewMetricTarget(e.target.value)}
                  placeholder="Target (e.g., 85%)"
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
                />
                <input
                  type="text"
                  value={newMetricUnit}
                  onChange={(e) => setNewMetricUnit(e.target.value)}
                  placeholder="Unit (optional, e.g., %)"
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
                />
              </div>
              <textarea
                value={newMetricNotes}
                onChange={(e) => setNewMetricNotes(e.target.value)}
                placeholder="Notes (optional — visible to employee and manager)"
                rows={2}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
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
            <div className="divide-y divide-line">
              {metrics.map((metric) => (
                <div key={metric.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink">{metric.name}</p>
                        {metric.templateId && <Badge variant="navy" className="text-[11px]">Role-set</Badge>}
                      </div>
                      <p className="text-xs muted">
                        Target: <span className="mono tnum text-ink">{metric.target}</span>
                        {metric.unit && <span className="mono"> {metric.unit}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!metric.notes && editingNotes !== metric.id && (
                        <Button size="sm" variant="ghost" onClick={() => { setEditingNotes(metric.id); setEditNotesValue(""); }}>
                          Add Note
                        </Button>
                      )}
                      {canEdit && !metric.templateId && (
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteMetric(metric.id)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  {metric.notes && editingNotes !== metric.id && (
                    <div
                      className="mt-2 text-sm text-ink bg-paper-2 rounded-lg px-3 py-2 cursor-pointer hover:bg-line/40"
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
                        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
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
            <p className="text-sm muted text-center py-2">No key metrics set yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <div>
            <Eyebrow className="mb-1">Time-bound objectives</Eyebrow>
            <h2 className="card-title">Goals</h2>
          </div>
          {canEdit && !showGoalForm && (
            <Button size="sm" variant="secondary" onClick={() => setShowGoalForm(true)}>
              Add Goal
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showGoalForm && (
            <div className="rounded-lg border border-line p-4 mb-4 space-y-3">
              <input
                type="text"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                placeholder="Goal title"
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
              />
              <textarea
                value={newGoalDesc}
                onChange={(e) => setNewGoalDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
              />
              <div>
                <label className="text-xs muted block mb-1">Due date (optional)</label>
                <input
                  type="date"
                  value={newGoalDue}
                  onChange={(e) => setNewGoalDue(e.target.value)}
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink mono focus:outline-none focus:ring-2 focus:ring-magenta"
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

          {activeGoals.length > 0 && (
            <div className="space-y-3">
              {activeGoals.map((goal) => (
                <div key={goal.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink">{goal.title}</p>
                        {goal.templateId && <Badge variant="navy" className="text-[11px]">Role-set</Badge>}
                      </div>
                      {goal.description && <p className="text-sm muted mt-0.5">{goal.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        {goal.dueDate && (
                          <span className="text-xs muted">
                            Due: <span className="mono tnum">{new Date(goal.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
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
            <p className="text-sm muted text-center py-2">No active goals.</p>
          )}

          {completedGoals.length > 0 && (
            <div className="mt-4">
              <p className="eyebrow mb-2">Past Goals</p>
              <div className="space-y-2">
                {completedGoals.map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between py-2 opacity-60">
                    <div>
                      <p className="text-sm text-ink line-through">{goal.title}</p>
                      {goal.dueDate && (
                        <span className="text-xs muted">
                          Due: <span className="mono tnum">{new Date(goal.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </span>
                      )}
                    </div>
                    <Badge variant={goal.status === "COMPLETED" ? "success" : "slate"}>
                      {goal.status === "COMPLETED" ? "Completed" : "Cancelled"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardContent>
          <TasksPanel
            employeeId={employeeId}
            canManage={!!canEdit}
            assigneeOptions={[
              { id: employee.id, name: employee.name },
              ...(session?.user?.id && session.user.name && session.user.id !== employee.id
                ? [{ id: session.user.id, name: session.user.name }]
                : []),
            ]}
            emptyText="No tasks yet. Tasks created in 1:1 meetings appear here."
          />
        </CardContent>
      </Card>

      {/* Performance Improvement Plan (manager-only) */}
      {canEdit && <PerformancePlanCard employeeId={employeeId} employeeName={employee.name} />}

      {/* Performance History */}
      <Card>
        <CardHeader>
          <div>
            <Eyebrow className="mb-1">Assessment record</Eyebrow>
            <h2 className="card-title">Performance History</h2>
          </div>
        </CardHeader>
        <CardContent>
          {assessments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="dt-head">
                    <th className="text-left py-2 px-2 eyebrow">Period</th>
                    <th className="text-center py-2 px-2 eyebrow">Performance</th>
                    <th className="text-center py-2 px-2 eyebrow">Growth</th>
                    <th className="text-center py-2 px-2 eyebrow">Values</th>
                    <th className="text-center py-2 px-2 eyebrow">Engagement</th>
                    <th className="text-center py-2 px-2 eyebrow">TD</th>
                    <th className="text-center py-2 px-2 eyebrow">CM</th>
                    <th className="text-right py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => {
                    const va = a.valCustomerFirst && a.valStepIntoArena && a.valFlockToProblems && a.valGiveEnergy
                      ? getValuesAlignment(a.valCustomerFirst, a.valStepIntoArena, a.valFlockToProblems, a.valGiveEnergy)
                      : null;
                    const td = a.performance && a.growthReadiness ? a.performance * a.growthReadiness : null;
                    const cm = va && a.engagement ? va * a.engagement : null;

                    return (
                      <tr key={a.id} className="dt-row">
                        <td className="py-2 px-2 font-medium text-ink mono tnum">
                          {formatCyclePeriod(a.cycle)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {a.performance ? (
                            <Badge variant={ratingVariant(a.performance)}>{getRatingLabel(a.performance)}</Badge>
                          ) : <span className="muted-2">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {a.growthReadiness ? (
                            <Badge variant={ratingVariant(a.growthReadiness)}>{getGrowthReadinessLabel(a.growthReadiness)}</Badge>
                          ) : <span className="muted-2">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {va ? (
                            <Badge variant={ratingVariant(va)}>{getRatingLabel(va)}</Badge>
                          ) : <span className="muted-2">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {a.engagement ? (
                            <Badge variant={ratingVariant(a.engagement)}>{getRatingLabel(a.engagement)}</Badge>
                          ) : <span className="muted-2">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {td !== null ? (
                            <span className={`mono tnum text-sm ${td >= 6 ? "text-success" : "text-magenta"}`}>{td}/9</span>
                          ) : <span className="muted-2">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {cm !== null ? (
                            <span className={`mono tnum text-sm ${cm >= 6 ? "text-success" : "text-magenta"}`}>{cm}/9</span>
                          ) : <span className="muted-2">-</span>}
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
            <p className="text-sm muted text-center py-4">No assessment history yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
