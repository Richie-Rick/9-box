"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { formatCyclePeriod } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  team: string | null;
  selfAssessmentStatus: "not_started" | "draft" | "submitted";
  managerAssessmentStatus: "not_started" | "draft" | "submitted";
  meetingStatus?: string;
  meetingStarted?: boolean;
  managerAssessmentId?: string | null;
  resultsSentAt: string | null;
}

interface CycleData {
  id: string;
  month: number | null;
  quarter: number | null;
  year: number;
  status: "OPEN" | "CLOSED";
}

function statusVariant(status: TeamMember["selfAssessmentStatus"]) {
  return status === "submitted" ? "success" : status === "draft" ? "warning" : "slate";
}

function statusLabel(status: TeamMember["selfAssessmentStatus"]) {
  return status === "submitted" ? "Done" : status === "draft" ? "Draft" : "Pending";
}

export default function MyTeamPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [cycle, setCycle] = useState<CycleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cycles")
      .then((r) => r.json())
      .then((cycles: CycleData[]) => {
        const current = cycles.find((c) => c.status === "OPEN") || cycles[0];
        if (current) {
          setCycle(current);
          return fetch(`/api/team?cycleId=${current.id}`).then((r) => r.json());
        }
        return [];
      })
      .then((teamData) => {
        if (Array.isArray(teamData)) setTeam(teamData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 muted">Loading...</div>;

  if (!session?.user?.role || session.user.role === "EMPLOYEE") {
    return (
      <div>
        <PageHeader
          eyebrow="Directory"
          title={<>Your <em>team.</em></>}
        />
        <p className="muted">You don&apos;t have team members assigned to you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Directory"
        title={<>Your <em>team.</em></>}
        sub={
          cycle ? (
            <span className="inline-flex items-center gap-2">
              <span>
                Current cycle: <span className="mono tnum">{formatCyclePeriod(cycle)}</span>
              </span>
              {cycle.status === "OPEN" && <Badge variant="success">Open</Badge>}
            </span>
          ) : undefined
        }
      />

      {team.length === 0 ? (
        <Card>
          <p className="text-sm muted py-4 text-center">
            No direct reports found. Ask your admin to assign employees to you.
          </p>
        </Card>
      ) : (
        <div className="grid-12">
          {team.map((member) => {
            const bothSubmitted = member.selfAssessmentStatus === "submitted" && member.managerAssessmentStatus === "submitted";
            return (
              <Card key={member.id} hover className="col-4 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <Avatar name={member.name} size="lg" />
                  <div className="min-w-0">
                    <p className="serif text-lg leading-tight text-ink truncate">{member.name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {member.jobTitle && <span className="text-xs muted">{member.jobTitle}</span>}
                      {member.jobTitle && member.team && <span className="text-xs muted-2">&middot;</span>}
                      {member.team && <span className="text-xs muted">{member.team}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs muted">Self:</span>
                  <Badge variant={statusVariant(member.selfAssessmentStatus)}>
                    {statusLabel(member.selfAssessmentStatus)}
                  </Badge>
                  <span className="text-xs muted">Manager:</span>
                  <Badge variant={statusVariant(member.managerAssessmentStatus)}>
                    {statusLabel(member.managerAssessmentStatus)}
                  </Badge>
                  {member.resultsSentAt && <Badge variant="success">Results Sent</Badge>}
                </div>

                <div className="flex flex-wrap gap-2 mt-auto pt-1">
                  <Button size="sm" variant="secondary" onClick={() => router.push(`/team/${member.id}`)}>
                    View Profile
                  </Button>
                  {cycle && (
                    <Button
                      size="sm"
                      variant={member.managerAssessmentStatus === "submitted" ? "secondary" : "primary"}
                      onClick={() => router.push(`/assess/${member.id}?cycleId=${cycle.id}`)}
                    >
                      {member.managerAssessmentStatus === "submitted" ? "Edit Review" : "Assess"}
                    </Button>
                  )}
                  {cycle && bothSubmitted && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push(`/summary/${member.id}?cycleId=${cycle.id}`)}
                    >
                      Review Summary
                    </Button>
                  )}
                  {cycle && member.managerAssessmentStatus === "submitted" && !bothSubmitted && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push(`/summary/${member.id}?cycleId=${cycle.id}`)}
                    >
                      View
                    </Button>
                  )}
                  {member.meetingStatus === "MEETING_SCHEDULED" && member.managerAssessmentId && (
                    <Button
                      size="sm"
                      onClick={() => window.open(`/meeting/${member.managerAssessmentId}`, "_blank", "noopener")}
                    >
                      {member.meetingStarted ? "Edit Meeting Notes" : "Start Meeting"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
