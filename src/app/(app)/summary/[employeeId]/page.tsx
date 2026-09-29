"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCyclePeriod } from "@/lib/utils";
import { buildComparisonRows } from "@/lib/comparison";
import { computeStage } from "@/lib/stages";
import { GoalsMetricsCard } from "@/components/goals/goals-metrics-card";
import { ShareModal } from "@/components/assessments/share-modal";
import { MeetingView } from "@/components/assessments/meeting-view";
import { StageBadge } from "@/components/ui/stage-badge";
import {
  getBox1Label,
  getBox2Label,
  getValuesAlignment,
  getBox1Action,
  getBox2Action,
  getBox1Color,
  getBox2Color,
} from "@/lib/nine-box";
import { DimensionComparison } from "@/components/assessments/dimension-comparison";

interface SummaryData {
  employee: { id: string; name: string; email: string; jobTitle: string | null; team: string | null; role: string };
  cycle: { id: string; month: number; year: number; status: string } | null;
  selfAssessment: SelfView | null;
  managerAssessment: ManagerView | null;
}

interface SelfView {
  [key: string]: unknown;
  performance: number | null;
  submittedAt: string | null;
}

interface ManagerView {
  [key: string]: unknown;
  id: string;
  performance: number | null;
  growthReadiness: number | null;
  valCustomerFirst: number | null;
  valStepIntoArena: number | null;
  valFlockToProblems: number | null;
  valGiveEnergy: number | null;
  engagement: number | null;
  initialRatings: Record<string, number> | null;
  submittedAt: string | null;
  sharedAt: string | null;
  oneOnOneComplete: boolean;
  oneOnOneNotes: string | null;
  oneOnOneCompletedAt: string | null;
  editCount?: number;
  lastEditedAt?: string | null;
  manager: { id: string; name: string };
}

interface RevisionData {
  id: string;
  changedAt: string;
  changedBy: { id: string; name: string };
  reason: string | null;
  changes: { field: string; label: string; before: unknown; after: unknown }[];
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  return String(value);
}

export default function SummaryPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params);
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const cycleId = searchParams.get("cycleId");
  const meetingMode = searchParams.get("mode") === "meeting";
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [revisions, setRevisions] = useState<RevisionData[] | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);

  useEffect(() => {
    if (!cycleId) return;
    fetch(`/api/assessments/summary?employeeId=${employeeId}&cycleId=${cycleId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [employeeId, cycleId]);

  const { employee, cycle, selfAssessment: self, managerAssessment: mgr } = data ?? {};
  const isManagerView = !!mgr?.manager?.id && mgr.manager.id === session?.user?.id;
  const isLeadership = session?.user?.role === "LEADERSHIP" || session?.user?.role === "ADMIN";
  const isEmployeeView = employeeId === session?.user?.id;
  const editCount = mgr?.editCount ?? 0;

  useEffect(() => {
    if (!mgr?.id || editCount === 0 || !(isManagerView || isLeadership)) return;
    fetch(`/api/assessments/manager/${mgr.id}/revisions`)
      .then((r) => r.json())
      .then((d) => setRevisions(Array.isArray(d) ? d : []))
      .catch(() => setRevisions([]));
  }, [mgr?.id, editCount, isManagerView, isLeadership]);

  async function handleShare() {
    if (!mgr?.id) return;
    setSharing(true);
    try {
      const res = await fetch("/api/assessments/manager/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: mgr.id }),
      });
      if (res.ok) {
        const { sharedAt } = await res.json();
        setData((prev) => prev && prev.managerAssessment ? { ...prev, managerAssessment: { ...prev.managerAssessment, sharedAt } } : prev);
      }
    } finally {
      setSharing(false);
      setShowShare(false);
    }
  }

  function setMode(mode: "meeting" | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (mode) params.set("mode", mode);
    else params.delete("mode");
    router.replace(`/summary/${employeeId}?${params.toString()}`);
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!data || !employee) return <div className="text-center py-12 text-gray-500">Summary not found.</div>;

  const canShare = isManagerView && !!mgr?.submittedAt && !mgr?.sharedAt;

  const mgrValuesAlignment = mgr?.valCustomerFirst && mgr?.valStepIntoArena && mgr?.valFlockToProblems && mgr?.valGiveEnergy
    ? getValuesAlignment(mgr.valCustomerFirst, mgr.valStepIntoArena, mgr.valFlockToProblems, mgr.valGiveEnergy)
    : null;
  const box1Label = mgr?.performance && mgr?.growthReadiness ? getBox1Label(mgr.performance, mgr.growthReadiness) : null;
  const box2Label = mgrValuesAlignment && mgr?.engagement ? getBox2Label(mgrValuesAlignment, mgr.engagement) : null;

  const comparisonRows = buildComparisonRows(self, mgr, { initialRatings: mgr?.initialRatings ?? null });

  const stage = computeStage({
    selfStarted: self?.performance !== null && self?.performance !== undefined,
    selfSubmitted: !!self?.submittedAt,
    managerStarted: mgr?.performance !== null && mgr?.performance !== undefined,
    managerSubmitted: !!mgr?.submittedAt,
    sharedAt: mgr?.sharedAt,
    oneOnOneCompletedAt: mgr?.oneOnOneCompletedAt,
  });

  const canRunMeeting = (isManagerView || isLeadership) && !!mgr?.submittedAt && !!cycle;

  if (meetingMode && canRunMeeting && mgr && cycle) {
    return (
      <MeetingView
        assessmentId={mgr.id}
        employee={employee}
        cycle={cycle}
        stage={stage}
        rows={comparisonRows}
        box1Label={box1Label}
        box2Label={box2Label}
        isManager={isManagerView}
        initialNotes={mgr.oneOnOneNotes ?? ""}
        oneOnOneCompletedAt={mgr.oneOnOneCompletedAt}
        onCompleted={(completedAt) =>
          setData((prev) => prev && prev.managerAssessment ? {
            ...prev,
            managerAssessment: { ...prev.managerAssessment, oneOnOneComplete: true, oneOnOneCompletedAt: completedAt, sharedAt: prev.managerAssessment.sharedAt ?? completedAt },
          } : prev)
        }
        onExit={() => setMode(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-visory-navy">{employee.name}</h1>
          {(employee.jobTitle || employee.team) && (
            <p className="text-sm text-gray-500 mt-0.5">
              {[employee.jobTitle, employee.team].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-sm text-gray-600">
              Assessment Summary {cycle ? `— ${formatCyclePeriod(cycle.month, cycle.year)}` : ""}
            </p>
            <StageBadge stage={stage} />
            {editCount > 0 && (isManagerView || isLeadership) && (
              <button
                type="button"
                onClick={() => setShowRevisions((v) => !v)}
                className="text-xs text-gray-500 underline underline-offset-2 hover:text-visory-navy"
              >
                Edited {editCount} time{editCount === 1 ? "" : "s"}
                {mgr?.lastEditedAt ? ` · last ${formatDateTime(mgr.lastEditedAt)}` : ""}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canShare && (
            <Button size="sm" onClick={() => setShowShare(true)}>
              Share with {employee.name.split(" ")[0]}
            </Button>
          )}
          {canRunMeeting && (
            <Button size="sm" variant="secondary" onClick={() => setMode("meeting")}>
              {mgr?.oneOnOneCompletedAt ? "Meeting view" : "Start meeting mode"}
            </Button>
          )}
          {isManagerView && cycle && (
            <Button size="sm" variant="ghost" onClick={() => router.push(`/assess/${employee.id}?cycleId=${cycle.id}`)}>
              Open assessment
            </Button>
          )}
        </div>
      </div>

      {showRevisions && revisions && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Edit history</h2>
            <p className="text-xs text-gray-500">Changes made after submission, most recent first</p>
          </CardHeader>
          <CardContent>
            {revisions.length === 0 ? (
              <p className="text-sm text-gray-400">No revisions recorded.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {revisions.map((r) => (
                  <div key={r.id} className="py-3">
                    <p className="text-sm text-visory-navy">
                      <span className="font-medium">{r.changedBy.name}</span> · {formatDateTime(r.changedAt)}
                      {r.reason && <span className="text-gray-600"> · {r.reason}</span>}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {r.changes.map((c) => (
                        <li key={c.field} className="text-xs text-gray-600">
                          <span className="font-medium text-gray-700">{c.label}:</span>{" "}
                          <span className="line-through text-gray-400">{formatValue(c.before)}</span>{" "}
                          <span>{formatValue(c.after)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Talent Density & Cultural Momentum Scores */}
      {(mgr?.performance && mgr?.growthReadiness) || (mgrValuesAlignment && mgr?.engagement) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mgr?.performance && mgr?.growthReadiness && (
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Talent Density</p>
                <p className={`text-3xl font-bold ${mgr.performance * mgr.growthReadiness >= 6 ? "text-green-700" : "text-orange-600"}`}>
                  {mgr.performance * mgr.growthReadiness}/9
                </p>
                <p className="text-xs text-gray-500 mt-1">Target: 6/9</p>
              </CardContent>
            </Card>
          )}
          {mgrValuesAlignment && mgr?.engagement && (
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Cultural Momentum</p>
                <p className={`text-3xl font-bold ${mgrValuesAlignment * mgr.engagement >= 6 ? "text-green-700" : "text-orange-600"}`}>
                  {mgrValuesAlignment * mgr.engagement}/9
                </p>
                <p className="text-xs text-gray-500 mt-1">Target: 6/9</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* 9-Box Placements */}
      {(box1Label || box2Label) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {box1Label && (
            <div className={`rounded-lg border-2 p-4 ${getBox1Color(box1Label)}`}>
              <p className="text-xs font-medium text-gray-500 uppercase">Talent Density</p>
              <p className="text-lg font-bold mt-1">{box1Label}</p>
              <p className="text-sm text-visory-navy mt-2">{getBox1Action(box1Label)}</p>
            </div>
          )}
          {box2Label && (
            <div className={`rounded-lg border-2 p-4 ${getBox2Color(box2Label)}`}>
              <p className="text-xs font-medium text-gray-500 uppercase">Cultural Momentum</p>
              <p className="text-lg font-bold mt-1">{box2Label}</p>
              <p className="text-sm text-visory-navy mt-2">{getBox2Action(box2Label)}</p>
            </div>
          )}
        </div>
      )}

      {/* Goals and metrics with this cycle's progress updates */}
      {cycle && (
        <GoalsMetricsCard
          employeeId={employee.id}
          cycleId={cycle.id}
          variant="compact"
          canEdit={isManagerView || isLeadership}
          isSelf={isEmployeeView}
          title="Goals & Key Metrics"
        />
      )}

      {/* Side-by-side Comparison */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Assessment Comparison</h2>
          <p className="text-xs text-gray-500">Click a dimension to expand and compare notes</p>
        </CardHeader>
        <CardContent>
          <DimensionComparison rows={comparisonRows} />
        </CardContent>
      </Card>

      {/* Meeting notes: manager and leadership always, the employee once the 1:1 is done */}
      {mgr?.submittedAt && (isManagerView || isLeadership || (isEmployeeView && mgr.oneOnOneCompletedAt)) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">1:1 Meeting Notes</h2>
                {mgr.oneOnOneCompletedAt ? (
                  <p className="text-xs text-gray-500">Held {formatDateTime(mgr.oneOnOneCompletedAt)}</p>
                ) : (
                  <p className="text-xs text-gray-500">Not yet held. Open meeting mode to take notes and record actions.</p>
                )}
              </div>
              {isManagerView && (
                <Button variant="ghost" size="sm" onClick={() => setMode("meeting")}>
                  {mgr.oneOnOneCompletedAt ? "Edit in meeting view" : "Open meeting mode"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {mgr.oneOnOneNotes ? (
              <p className="text-sm text-visory-navy whitespace-pre-wrap">{mgr.oneOnOneNotes}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No notes recorded.</p>
            )}
          </CardContent>
        </Card>
      )}

      {!self?.submittedAt && !mgr?.submittedAt && (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500 py-4 text-center">
              No assessments have been submitted for this cycle yet.
            </p>
          </CardContent>
        </Card>
      )}

      {showShare && (
        <ShareModal
          memberName={employee.name}
          selfSubmitted={!!self?.submittedAt}
          busy={sharing}
          onConfirm={handleShare}
          onCancel={() => setShowShare(false)}
        />
      )}

      {mgr?.sharedAt && !isEmployeeView && (
        <p className="text-xs text-gray-400 text-center">
          <Badge className="bg-visory-light text-visory-dark border-visory/30 mr-2">Shared</Badge>
          {employee.name.split(" ")[0]} has been able to see this review since {formatDateTime(mgr.sharedAt)}.
        </p>
      )}
    </div>
  );
}
