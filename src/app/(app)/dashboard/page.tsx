"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { TasksPanel } from "@/components/tasks/tasks-panel";
import { PersonalCyclesSection } from "@/components/assessments/personal-cycles";
import { KanbanBoard } from "@/components/meetings/kanban-board";
import type { CycleData, TeamMemberStatus, TaskData } from "@/types";
import { formatCyclePeriod, comparePeriodDesc, pickDefaultCycle } from "@/lib/utils";

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (!role) return <div className="text-center py-12 muted">Loading...</div>;
  if (role === "EMPLOYEE") return <EmployeeDashboard />;
  return <ManagerDashboard />;
}

function EmployeeDashboard() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your workspace"
        title={<>My <em>dashboard.</em></>}
        sub="Your performance cycle status"
      />

      <PersonalCyclesSection showGoals />

      {/* My Tasks */}
      {session?.user?.id && (
        <Card>
          <TasksPanel
            employeeId={session.user.id}
            emptyText="No tasks assigned to you yet. Actions agreed in your 1:1 will appear here."
          />
        </Card>
      )}
    </div>
  );
}

function ManagedTasks({ tasks }: { tasks: TaskData[] }) {
  const open = tasks.filter((t) => t.status !== "DONE");
  if (tasks.length === 0) {
    return (
      <p className="text-sm muted text-center py-2">
        No tasks yet. Actions agreed in your 1:1 meetings appear here.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {open.length === 0 && (
        <p className="text-sm muted text-center py-2">All tasks are done.</p>
      )}
      {open.map((task) => (
        <div key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">{task.title}</p>
            <div className="flex flex-wrap items-center gap-2 tiny muted">
              {task.employee && (
                <Link href={`/team/${task.employee.id}`} className="text-magenta hover:text-magenta-2 font-medium">
                  {task.employee.name}
                </Link>
              )}
              <span>· {task.assignee?.name ?? "Unassigned"}</span>
              {task.dueDate && (
                <span>· due <span className="mono tnum">{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></span>
              )}
            </div>
          </div>
          <Badge variant={task.status === "IN_PROGRESS" ? "warning" : "slate"}>
            {task.status === "IN_PROGRESS" ? "In Progress" : "To Do"}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function ManagerDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [team, setTeam] = useState<TeamMemberStatus[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);

  useEffect(() => {
    fetch("/api/cycles")
      .then((r) => r.json())
      .then((cs: CycleData[]) => {
        const sorted = [...cs].sort(comparePeriodDesc);
        setCycles(sorted);
        // Default to the most recently opened cycle; managers can toggle below.
        setSelectedCycleId(pickDefaultCycle(sorted)?.id ?? "");
      });
    fetch("/api/tasks?scope=managed")
      .then((r) => (r.ok ? r.json() : []))
      .then((t) => setTasks(Array.isArray(t) ? t : []));
  }, []);

  useEffect(() => {
    if (!selectedCycleId) return;
    fetch(`/api/team?cycleId=${selectedCycleId}`)
      .then((r) => r.json())
      .then((t) => setTeam(Array.isArray(t) ? t : []));
  }, [selectedCycleId]);

  const cycle = cycles.find((c) => c.id === selectedCycleId) ?? null;
  const assessed = team.filter((t) => t.managerAssessmentStatus === "submitted").length;
  const selfDone = team.filter((t) => t.selfAssessmentStatus === "submitted").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your workspace"
        title={<>Manager <em>dashboard.</em></>}
        sub={
          cycle ? (
            <span className="inline-flex items-center gap-2">
              <span>{formatCyclePeriod(cycle)}</span>
              <Badge variant={cycle.status === "OPEN" ? "success" : "slate"}>
                {cycle.status === "OPEN" ? "Open" : "Closed"}
              </Badge>
            </span>
          ) : (
            "Track your team through the current cycle"
          )
        }
        actions={
          cycles.length > 0 ? (
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              aria-label="Select cycle"
              className="rounded-lg border border-line-2 bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-magenta focus:ring-2 focus:ring-magenta/20"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatCyclePeriod(c)}
                  {c.status === "OPEN" ? " · Open" : ""}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {/* Admin quick links */}
      {role === "ADMIN" && (
        <div className="grid-12">
          <Card hover className="col-6 cursor-pointer" onClick={() => router.push("/admin/cycles")}>
            <div className="eyebrow mb-2">Admin</div>
            <h3 className="serif text-lg">Assessment Cycles</h3>
            <p className="text-sm muted mt-1">Open, close, and manage quarterly cycles</p>
          </Card>
          <Card hover className="col-6 cursor-pointer" onClick={() => router.push("/admin/users")}>
            <div className="eyebrow mb-2">Admin</div>
            <h3 className="serif text-lg">User Management</h3>
            <p className="text-sm muted mt-1">Invite users, assign roles and managers</p>
          </Card>
        </div>
      )}

      {/* Your own assessment — managers and above are assessed too */}
      <PersonalCyclesSection compact />

      {cycle && (
        <>
          {/* Summary stats */}
          <div className="grid-12">
            <Card className="col-6">
              <div className="eyebrow mb-2">Self-Assessments Done</div>
              <p className="serif text-3xl mono tnum">{selfDone}<span className="muted"> / {team.length}</span></p>
            </Card>
            <Card className="col-6">
              <div className="eyebrow mb-2">Manager Assessments Done</div>
              <p className="serif text-3xl mono tnum">{assessed}<span className="muted"> / {team.length}</span></p>
            </Card>
          </div>

          {/* Meeting Kanban board */}
          <Card>
            <CardHeader>
              <div>
                <div className="eyebrow mb-2">Current cycle</div>
                <CardTitle>Meeting <em>pipeline.</em></CardTitle>
                <p className="text-sm muted mt-1">
                  Track each report against the cycle due dates. Drag a card between columns to update meeting status.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {team.length === 0 ? (
                <p className="py-4 text-center text-sm muted">
                  No direct reports found. Ask your admin to assign employees to you.
                </p>
              ) : (
                <KanbanBoard members={team} cycle={cycle} />
              )}
            </CardContent>
          </Card>

          {/* Tasks across the team */}
          <Card>
            <CardHeader>
              <CardTitle>Team <em>tasks.</em></CardTitle>
            </CardHeader>
            <CardContent>
              <ManagedTasks tasks={tasks} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
