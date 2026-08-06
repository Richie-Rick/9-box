"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import type { CycleData, TeamMemberStatus } from "@/types";
import { formatCyclePeriod } from "@/lib/utils";

export default function AssessTeamPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [team, setTeam] = useState<TeamMemberStatus[]>([]);

  useEffect(() => {
    fetch("/api/cycles")
      .then((r) => r.json())
      .then((data: CycleData[]) => {
        setCycles(data);
        const open = data.find((c) => c.status === "OPEN");
        if (open) setSelectedCycleId(open.id);
        else if (data.length > 0) setSelectedCycleId(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedCycleId) return;
    fetch(`/api/team?cycleId=${selectedCycleId}`)
      .then((r) => r.json())
      .then(setTeam);
  }, [selectedCycleId]);

  if (session?.user?.role === "EMPLOYEE") {
    router.push("/dashboard");
    return null;
  }

  function statusVariant(status: string) {
    if (status === "submitted") return "success" as const;
    if (status === "draft") return "warning" as const;
    return "slate" as const;
  }

  function statusLabel(status: string) {
    return status === "submitted" ? "Done" : status === "draft" ? "Draft" : "Pending";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manager"
        title={<>Assess your <em>team.</em></>}
        sub="Review and assess your direct reports"
        actions={
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="mono tnum rounded-full border border-line-2 bg-paper px-3 py-2 text-sm text-ink"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{formatCyclePeriod(c)}</option>
            ))}
          </select>
        }
      />

      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">Direct reports</div>
            <h2 className="card-title">Team Members</h2>
          </div>
        </div>
        <div className="divide-y divide-line">
          {team.map((member) => (
            <div key={member.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={member.name} size="md" />
                <div>
                  <p className="text-sm font-medium text-ink">{member.name}</p>
                  <p className="text-xs text-ink-3">{member.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(member.selfAssessmentStatus)}>
                  Self: {statusLabel(member.selfAssessmentStatus)}
                </Badge>
                <Badge variant={statusVariant(member.managerAssessmentStatus)}>
                  Mgr: {statusLabel(member.managerAssessmentStatus)}
                </Badge>
                <Button
                  size="sm"
                  variant={member.managerAssessmentStatus === "submitted" ? "ghost" : "primary"}
                  onClick={() => router.push(`/assess/${member.id}?cycleId=${selectedCycleId}`)}
                >
                  {member.managerAssessmentStatus === "submitted" ? "Edit Review" : "Assess"}
                </Button>
                {member.managerAssessmentStatus === "submitted" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => router.push(`/summary/${member.id}?cycleId=${selectedCycleId}`)}
                  >
                    Summary
                  </Button>
                )}
              </div>
            </div>
          ))}
          {team.length === 0 && (
            <p className="py-4 text-center text-sm text-ink-3">
              No team members found. Ask your admin to assign employees to you.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
