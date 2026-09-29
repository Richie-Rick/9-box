"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CycleData, TeamMemberStatus } from "@/types";
import { StageBadge } from "@/components/ui/stage-badge";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-visory-navy">Assess Team</h1>
          <p className="text-sm text-gray-600 mt-1">Review and assess your direct reports</p>
        </div>
        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-visory"
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{formatCyclePeriod(c.month, c.year)}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Team Members</h2>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100">
            {team.map((member) => (
              <div key={member.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-visory-navy">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StageBadge stage={member.stage} />
                  <span className="text-xs text-gray-500">
                    Self {member.selfAssessmentStatus === "submitted" ? "in" : member.selfAssessmentStatus === "draft" ? "draft" : "pending"}
                  </span>
                  <Button
                    size="sm"
                    variant={member.managerAssessmentStatus === "submitted" ? "ghost" : "primary"}
                    onClick={() => router.push(`/assess/${member.id}?cycleId=${selectedCycleId}`)}
                  >
                    {member.managerAssessmentStatus === "submitted" ? "View" : "Assess"}
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
              <p className="py-4 text-center text-sm text-gray-500">
                No team members found. Ask your admin to assign employees to you.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
