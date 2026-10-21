"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

interface MetricTemplateData {
  id: string;
  name: string;
  target: string;
  unit: string | null;
  notes: string | null;
  team: string | null;
  isActive: boolean;
  _count: { metrics: number };
}

interface GoalTemplateData {
  id: string;
  title: string;
  description: string | null;
  dueOffsetDays: number | null;
  team: string | null;
  isActive: boolean;
  _count: { goals: number };
}

interface RoleData {
  id: string;
  name: string;
  isActive: boolean;
  users: { id: string; name: string; team: string | null }[];
  metricTemplates: MetricTemplateData[];
  goalTemplates: GoalTemplateData[];
}

const INPUT_CLASS =
  "rounded-lg border border-line-2 bg-paper-2 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-magenta focus:ring-2 focus:ring-magenta/20";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function AdminRolesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMetricForm, setShowMetricForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [metricDraft, setMetricDraft] = useState({ name: "", target: "", unit: "", notes: "", team: "" });
  const [goalDraft, setGoalDraft] = useState({ title: "", description: "", dueOffsetDays: "", team: "" });
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    fetch("/api/admin/roles")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRoles(data);
          setSelectedId((current) => current ?? data[0]?.id ?? null);
        }
      });
  }, []);

  useEffect(() => {
    if (session?.user?.role && session.user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    if (session?.user?.role === "ADMIN") load();
  }, [session, router, load]);

  async function call(url: string, method: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return null;
      }
      return data;
    } catch {
      setError("Could not reach the server");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function addRole() {
    if (!newRole.trim()) return;
    const created = await call("/api/admin/roles", "POST", { name: newRole });
    if (created) {
      setNewRole("");
      load();
      setSelectedId(created.id as string);
    }
  }

  async function toggleRole(role: RoleData) {
    const ok = await call("/api/admin/roles", "PATCH", { roleId: role.id, isActive: !role.isActive });
    if (ok) load();
  }

  async function addMetric() {
    if (!selectedId || !metricDraft.name.trim() || !metricDraft.target.trim()) return;
    const ok = await call("/api/admin/roles/templates", "POST", { kind: "metric", jobRoleId: selectedId, ...metricDraft });
    if (ok) {
      const created = (ok.instancesCreated as number) ?? 0;
      setNotice(`Metric template saved. ${plural(created, "key metric")} created for people in this role.`);
      setMetricDraft({ name: "", target: "", unit: "", notes: "", team: "" });
      setShowMetricForm(false);
      load();
    }
  }

  async function addGoal() {
    if (!selectedId || !goalDraft.title.trim()) return;
    const ok = await call("/api/admin/roles/templates", "POST", {
      kind: "goal",
      jobRoleId: selectedId,
      title: goalDraft.title,
      description: goalDraft.description,
      team: goalDraft.team,
      dueOffsetDays: goalDraft.dueOffsetDays ? Number(goalDraft.dueOffsetDays) : null,
    });
    if (ok) {
      const created = (ok.instancesCreated as number) ?? 0;
      setNotice(`Goal template saved. ${plural(created, "goal")} created for people in this role.`);
      setGoalDraft({ title: "", description: "", dueOffsetDays: "", team: "" });
      setShowGoalForm(false);
      load();
    }
  }

  async function toggleTemplate(kind: "metric" | "goal", template: { id: string; isActive: boolean }) {
    const result = await call("/api/admin/roles/templates", "PATCH", { kind, templateId: template.id, isActive: !template.isActive });
    if (result) {
      const created = (result.instancesCreated as number) ?? 0;
      const retired = (result.instancesRetired as number) ?? 0;
      const noun = kind === "goal" ? "goal" : "key metric";
      setNotice(
        created
          ? `${plural(created, noun)} created.`
          : retired
            ? kind === "goal"
              ? `${plural(retired, "active goal")} cancelled.`
              : `${plural(retired, "key metric")} without results removed; those with results are kept as history.`
            : ""
      );
      load();
    }
  }

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={<>Roles &amp; <em>templates.</em></>}
        sub="Metrics and goals set here flow through to everyone holding the role, labelled “Role-set”."
        actions={
          <>
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRole(); }}
              placeholder="New role name"
              className={INPUT_CLASS}
            />
            <Button size="sm" onClick={addRole} disabled={busy || !newRole.trim()}>Add role</Button>
          </>
        }
      />

      {error && <div className="rounded-lg bg-magenta-3 border border-magenta/25 p-3 text-sm text-magenta-2">{error}</div>}
      {notice && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-ink flex justify-between gap-3">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="underline underline-offset-2 text-ink-2">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <Card className="p-0 overflow-hidden self-start">
          <CardHeader className="px-5 pt-5">
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <div className="p-2">
            {roles.length === 0 && (
              <p className="text-sm text-ink-3 p-2">No roles yet. Add one, or they appear as people are given job titles.</p>
            )}
            <ul className="space-y-1">
              {roles.map((role) => (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => { setSelectedId(role.id); setShowGoalForm(false); setShowMetricForm(false); }}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                      role.id === selectedId ? "bg-navy text-white" : "hover:bg-paper-2 text-ink"
                    }`}
                  >
                    <span className={role.isActive ? "" : "line-through opacity-60"}>{role.name}</span>
                    <span className={`mono tnum text-xs ${role.id === selectedId ? "text-white/70" : "text-ink-3"}`}>{role.users.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {selected ? (
          <div className="space-y-6">
            <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="eyebrow mb-1">Role</div>
                <h2 className="serif text-xl text-ink">{selected.name}</h2>
                <p className="text-xs text-ink-3 mt-1">
                  Applies to {plural(selected.users.length, "active person").replace("persons", "people")}
                  {selected.users.length > 0 && `: ${selected.users.slice(0, 8).map((u) => u.name).join(", ")}${selected.users.length > 8 ? ` and ${selected.users.length - 8} more` : ""}`}
                </p>
              </div>
              <Button size="sm" variant={selected.isActive ? "ghost" : "secondary"} onClick={() => toggleRole(selected)} disabled={busy}>
                {selected.isActive ? "Deactivate role" : "Reactivate role"}
              </Button>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <div className="eyebrow mb-1">Targets</div>
                  <CardTitle>Role-set <em>metrics.</em></CardTitle>
                  <p className="text-xs text-ink-3 mt-1">Created as a key metric for each person in the role; results are recorded per person each cycle.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => { setShowMetricForm((v) => !v); setShowGoalForm(false); }}>
                  {showMetricForm ? "Cancel" : "Add metric"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {showMetricForm && (
                  <div className="rounded-lg border border-line bg-paper-2 p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input type="text" value={metricDraft.name} onChange={(e) => setMetricDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Metric name" className={INPUT_CLASS} />
                      <input type="text" value={metricDraft.target} onChange={(e) => setMetricDraft((d) => ({ ...d, target: e.target.value }))} placeholder="Target" className={INPUT_CLASS} />
                      <input type="text" value={metricDraft.unit} onChange={(e) => setMetricDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="Unit (optional)" className={INPUT_CLASS} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-2">
                      <input type="text" value={metricDraft.notes} onChange={(e) => setMetricDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Notes (optional)" className={INPUT_CLASS} />
                      <input type="text" value={metricDraft.team} onChange={(e) => setMetricDraft((d) => ({ ...d, team: e.target.value }))} placeholder="Only for team (optional)" className={INPUT_CLASS} />
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={addMetric} disabled={busy || !metricDraft.name.trim() || !metricDraft.target.trim()}>Save and create metrics</Button>
                    </div>
                  </div>
                )}
                {selected.metricTemplates.length === 0 && !showMetricForm && (
                  <p className="text-sm text-ink-3">No role-set metrics yet.</p>
                )}
                <ul className="divide-y divide-line">
                  {selected.metricTemplates.map((t) => (
                    <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                      <div>
                        <p className={`text-sm font-medium text-ink ${t.isActive ? "" : "line-through opacity-60"}`}>{t.name}</p>
                        <p className="text-xs text-ink-3">
                          Target <span className="mono tnum">{t.target}{t.unit ? ` ${t.unit}` : ""}</span>
                          {t.team ? ` · ${t.team} only` : ""}{t.notes ? ` · ${t.notes}` : ""} · {plural(t._count.metrics, "person")} 
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!t.isActive && <Badge variant="slate">Inactive</Badge>}
                        <Button size="sm" variant="ghost" onClick={() => toggleTemplate("metric", t)} disabled={busy}>
                          {t.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <div className="eyebrow mb-1">Objectives</div>
                  <CardTitle>Role-set <em>goals.</em></CardTitle>
                  <p className="text-xs text-ink-3 mt-1">Created as a goal for each person in the role, so each one carries its own status.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => { setShowGoalForm((v) => !v); setShowMetricForm(false); }}>
                  {showGoalForm ? "Cancel" : "Add goal"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {showGoalForm && (
                  <div className="rounded-lg border border-line bg-paper-2 p-3 space-y-2">
                    <input type="text" value={goalDraft.title} onChange={(e) => setGoalDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Goal title" className={`${INPUT_CLASS} w-full`} />
                    <textarea value={goalDraft.description} onChange={(e) => setGoalDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Description (optional)" rows={2} className={`${INPUT_CLASS} w-full`} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input type="number" min={1} value={goalDraft.dueOffsetDays} onChange={(e) => setGoalDraft((d) => ({ ...d, dueOffsetDays: e.target.value }))} placeholder="Due in N days (optional)" className={`${INPUT_CLASS} mono tnum`} />
                      <input type="text" value={goalDraft.team} onChange={(e) => setGoalDraft((d) => ({ ...d, team: e.target.value }))} placeholder="Only for team (optional)" className={INPUT_CLASS} />
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={addGoal} disabled={busy || !goalDraft.title.trim()}>Save and create goals</Button>
                    </div>
                  </div>
                )}
                {selected.goalTemplates.length === 0 && !showGoalForm && (
                  <p className="text-sm text-ink-3">No role-set goals yet.</p>
                )}
                <ul className="divide-y divide-line">
                  {selected.goalTemplates.map((t) => (
                    <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                      <div>
                        <p className={`text-sm font-medium text-ink ${t.isActive ? "" : "line-through opacity-60"}`}>{t.title}</p>
                        <p className="text-xs text-ink-3">
                          {t.description ? `${t.description} · ` : ""}
                          {t.dueOffsetDays ? `due ${t.dueOffsetDays} days after assignment · ` : ""}
                          {t.team ? `${t.team} only · ` : ""}
                          {plural(t._count.goals, "goal")} created
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!t.isActive && <Badge variant="slate">Inactive</Badge>}
                        <Button size="sm" variant="ghost" onClick={() => toggleTemplate("goal", t)} disabled={busy}>
                          {t.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {selected.users.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Who this applies to</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                    {selected.users.map((u) => (
                      <li key={u.id} className="text-sm text-ink">
                        {u.name}{u.team && <span className="text-xs text-ink-3"> · {u.team}</span>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent>
              <p className="text-sm text-ink-3 py-6 text-center">Select a role to manage its templates.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
