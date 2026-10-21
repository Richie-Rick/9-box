"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { KanbanBoard } from "@/components/meetings/kanban-board";
import type { CycleData, TeamMemberStatus } from "@/types";
import { formatCyclePeriod, comparePeriodDesc, pickDefaultCycle } from "@/lib/utils";

export default function TeamCyclesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = session?.user?.role;

  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [team, setTeam] = useState<TeamMemberStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // The board is a manager view; employees go back to their dashboard.
  useEffect(() => {
    if (role === "EMPLOYEE") router.push("/dashboard");
  }, [role, router]);

  useEffect(() => {
    fetch("/api/cycles")
      .then((r) => r.json())
      .then((cs: CycleData[]) => {
        const sorted = [...cs].sort(comparePeriodDesc);
        setCycles(sorted);
        // Default to the most recently opened cycle (matches the dashboard).
        setSelectedId(pickDefaultCycle(sorted)?.id ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    // Standard client fetch-then-set on cycle change.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoadingTeam(true);
    fetch(`/api/team?cycleId=${selectedId}`)
      .then((r) => r.json())
      .then((t) => setTeam(Array.isArray(t) ? t : []))
      .catch(() => setTeam([]))
      .finally(() => setLoadingTeam(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedId]);

  const selectedCycle = cycles.find((c) => c.id === selectedId) ?? null;

  if (loading) return <div className="text-center py-12 muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title={<>Assessment <em>cycles.</em></>}
        sub="Track every report’s meeting pipeline for any cycle."
        actions={
          cycles.length > 0 ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
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

      <Card>
        <CardHeader>
          <div>
            <div className="eyebrow mb-2">
              {selectedCycle ? formatCyclePeriod(selectedCycle) : "Cycle"}
            </div>
            <CardTitle>Meeting <em>pipeline.</em></CardTitle>
            <p className="text-sm muted mt-1">
              Drag a card between columns to update meeting status.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTeam ? (
            <p className="py-4 text-center text-sm muted">Loading team…</p>
          ) : team.length === 0 ? (
            <p className="py-4 text-center text-sm muted">
              No direct reports found for this cycle.
            </p>
          ) : (
            <KanbanBoard members={team} cycle={selectedCycle} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
