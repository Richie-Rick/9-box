"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { formatCyclePeriod } from "@/lib/utils";
import { getBox1Label, getBox2Label, getValuesAlignment, metricDisconnect } from "@/lib/nine-box";
import { PlacementCards } from "@/components/assessments/placement-cards";
import { ShareModal } from "@/components/assessments/share-modal";
import { DimensionComparison } from "@/components/assessments/dimension-comparison";
import { buildComparisonRows } from "@/lib/comparison";
import { GoalsPanel } from "@/components/assessments/goals-panel";
import { ReviewNotesPanel } from "@/components/assessments/review-notes-panel";
import { ActionsEditor } from "@/components/meetings/actions-editor";

interface SummaryData {
  employee: { id: string; name: string; email: string; jobTitle: string | null; team: string | null; role: string };
  cycle: { id: string; month: number | null; quarter: number | null; year: number; status: string } | null;
  selfAssessment: {
    performance: number | null;
    performanceJustification: string | null;
    achievements: string | null;
    blockers: string | null;
    learning: string | null;
    growthReadiness: number | null;
    growthReflection: string | null;
    valCustomerFirst: number | null;
    valStepIntoArena: number | null;
    valFlockToProblems: number | null;
    valGiveEnergy: number | null;
    valuesReflection: string | null;
    engagement: number | null;
    engagementDriver: string | null;
    supportNeeded: string | null;
    goalsNextMonth: string | null;
    submittedAt: string | null;
  } | null;
  managerAssessment: {
    id: string;
    performance: number | null;
    performanceEvidence: string | null;
    growthReadiness: number | null;
    growthReadinessEvidence: string | null;
    valCustomerFirst: number | null;
    valStepIntoArena: number | null;
    valFlockToProblems: number | null;
    valGiveEnergy: number | null;
    valuesEvidence: string | null;
    engagement: number | null;
    engagementEvidence: string | null;
    achievementsObserved: string | null;
    blockersToRemove: string | null;
    supportCommitted: string | null;
    notes: string | null;
    submittedAt: string | null;
    sharedAt: string | null;
    resultsSentAt: string | null;
    meetingStatus: string;
    manager: { id: string; name: string };
    initialRatings?: Record<string, number> | null;
    editedSinceShared?: boolean;
  } | null;
}

interface AuditEntry {
  id: string;
  action: string;
  summary: string | null;
  createdAt: string;
  actor: { id: string; name: string };
}

function AuditTrail({ assessmentId }: { assessmentId: string }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  useEffect(() => {
    fetch(`/api/audit?entityType=ManagerAssessment&entityId=${assessmentId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLogs(Array.isArray(d) ? d : []))
      .catch(() => setLogs([]));
  }, [assessmentId]);

  if (logs.length === 0) return null;

  return (
    <Card>
      <div className="card-head">
        <div>
          <div className="eyebrow">History</div>
          <h2 className="card-title">Audit Trail</h2>
        </div>
      </div>
      <CardContent>
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="text-sm text-ink-2 flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="mono tnum text-xs text-ink-3 whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span>
                <span className="font-medium text-ink">{log.actor.name}</span>
                {" — "}
                {log.summary || log.action}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ScoreOutOf3({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="eyebrow mb-1">{label}</p>
      <p className={`serif text-3xl ${value >= 2 ? "text-success" : "text-magenta"}`}>
        <span className="mono tnum">{value}</span><span className="text-base text-ink-3 mono tnum">/3</span>
      </p>
    </div>
  );
}

export default function SummaryPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params);
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const cycleId = searchParams.get("cycleId");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendingResults, setSendingResults] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [metricOutcomes, setMetricOutcomes] = useState({ hit: 0, missed: 0 });

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

  async function handleSendResults() {
    if (!data?.managerAssessment?.id) return;
    setSendingResults(true);
    try {
      const res = await fetch("/api/assessments/manager/send-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: data.managerAssessment.id }),
      });
      if (res.ok) {
        setData((prev) => prev ? {
          ...prev,
          managerAssessment: prev.managerAssessment ? { ...prev.managerAssessment, resultsSentAt: new Date().toISOString() } : null,
        } : null);
      }
    } finally {
      setSendingResults(false);
      setShowSendConfirm(false);
    }
  }

  async function handleShare() {
    if (!data?.managerAssessment?.id) return;
    setSharing(true);
    try {
      const res = await fetch("/api/assessments/manager/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: data.managerAssessment.id }),
      });
      if (res.ok) {
        const d = await res.json();
        setData((prev) => prev ? {
          ...prev,
          managerAssessment: prev.managerAssessment ? { ...prev.managerAssessment, sharedAt: d.sharedAt } : null,
        } : null);
      }
    } finally {
      setSharing(false);
      setShowShare(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-ink-3">Loading...</div>;
  if (!data || !data.employee) return <div className="text-center py-12 text-ink-3">Summary not found.</div>;

  const { employee, cycle, selfAssessment: self, managerAssessment: mgr } = data;
  const isManagerView = mgr?.manager?.id === session?.user?.id;
  const canShare = isManagerView && mgr?.submittedAt && !mgr?.sharedAt && !mgr?.resultsSentAt;
  const canSendResults = isManagerView && mgr?.submittedAt && self?.submittedAt && !mgr?.resultsSentAt;

  const mgrValuesAlignment = mgr?.valCustomerFirst && mgr?.valStepIntoArena && mgr?.valFlockToProblems && mgr?.valGiveEnergy
    ? getValuesAlignment(mgr.valCustomerFirst, mgr.valStepIntoArena, mgr.valFlockToProblems, mgr.valGiveEnergy)
    : null;
  const box1Label = mgr?.performance && mgr?.growthReadiness ? getBox1Label(mgr.performance, mgr.growthReadiness) : null;
  const box2Label = mgrValuesAlignment && mgr?.engagement ? getBox2Label(mgrValuesAlignment, mgr.engagement) : null;
  const ratingDisconnect = metricDisconnect(mgr?.performance ?? null, [
    ...Array(metricOutcomes.hit).fill({ achieved: true }),
    ...Array(metricOutcomes.missed).fill({ achieved: false }),
  ]).disconnect;

  // Rows come from the shared section config, so both sides' answers to the
  // same question sit together. The manager also sees where a rating moved
  // after the self-assessment was revealed.
  const comparisonSections = buildComparisonRows(self, mgr, {
    initialRatings: isManagerView ? mgr?.initialRatings : undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assessment summary"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={employee.name} size="lg" />
            <em>{employee.name}</em>
          </span>
        }
        sub={
          <span className="flex flex-wrap items-center gap-3">
            {(employee.jobTitle || employee.team) && (
              <span>{[employee.jobTitle, employee.team].filter(Boolean).join(" · ")}</span>
            )}
            <span className="mono tnum">{cycle ? formatCyclePeriod(cycle) : ""}</span>
            {mgr?.sharedAt && !mgr.resultsSentAt && <Badge variant="navy">Shared ahead of 1:1</Badge>}
            {mgr?.resultsSentAt && <Badge variant="success">Results Sent</Badge>}
            {mgr?.editedSinceShared && <Badge variant="warning">Updated since shared</Badge>}
          </span>
        }
        actions={
          canShare || canSendResults ? (
            <div className="flex flex-wrap items-center gap-2">
              {canShare && (
                <Button size="sm" onClick={() => setShowShare(true)}>
                  Share review with {employee.name}
                </Button>
              )}
              {canSendResults && (
                <Button size="sm" variant="magenta" onClick={() => setShowSendConfirm(true)}>
                  Send Results to {employee.name}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Performance & Growth (Talent Density) and Engagement & Values (Cultural
          Momentum) shown as separate scores out of 3 — not a combined /9. */}
      {(mgr?.performance && mgr?.growthReadiness) || (mgrValuesAlignment && mgr?.engagement) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mgr?.performance && mgr?.growthReadiness && (
            <Card>
              <CardContent className="py-2">
                <p className="eyebrow mb-3 text-center">Talent Density</p>
                <div className="grid grid-cols-2 gap-4">
                  <ScoreOutOf3 label="Performance" value={mgr.performance} />
                  <ScoreOutOf3 label="Growth Readiness" value={mgr.growthReadiness} />
                </div>
              </CardContent>
            </Card>
          )}
          {mgrValuesAlignment && mgr?.engagement && (
            <Card>
              <CardContent className="py-2">
                <p className="eyebrow mb-3 text-center">Cultural Momentum</p>
                <div className="grid grid-cols-2 gap-4">
                  <ScoreOutOf3 label="Engagement" value={mgr.engagement} />
                  <ScoreOutOf3 label="Values Alignment" value={mgrValuesAlignment} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* 9-Box Placements */}
      <PlacementCards box1Label={box1Label} box2Label={box2Label} />

      {ratingDisconnect && (
        <div className="rounded-lg bg-paper-2 border border-amber/40 p-3 text-sm text-ink-2">
          <span className="font-medium text-ink">Rating vs results:</span> {employee.name} missed more key metrics than
          they hit this cycle ({metricOutcomes.missed} missed, {metricOutcomes.hit} hit) but is rated{" "}
          {mgr?.performance === 3 ? "Exceeding" : "Meeting"} on performance.
        </div>
      )}

      {/* Side-by-side Comparison */}
      <Card>
        <div className="card-head">
          <div>
            <div className="eyebrow">Self vs manager</div>
            <h2 className="card-title">Assessment Comparison</h2>
          </div>
          <p className="text-xs text-ink-3">Click a dimension to expand and compare notes</p>
        </div>
        <CardContent>
          <DimensionComparison sections={comparisonSections} />
        </CardContent>
      </Card>

      {/* Goals & metrics reviewed this cycle (read-only) */}
      {cycle && (
        <GoalsPanel
          employeeId={employeeId}
          cycleId={cycle.id}
          defaultOpen
          onMetricsStatus={({ hit, missed }) => setMetricOutcomes({ hit, missed })}
        />
      )}

      {/* Review notes & meeting records */}
      {cycle && (
        <Card>
          <CardContent className="py-4">
            <ReviewNotesPanel employeeId={employeeId} cycleId={cycle.id} currentUserId={session?.user?.id} />
          </CardContent>
        </Card>
      )}

      {/* Actions (follow-up tasks) */}
      <Card>
        <ActionsEditor
          employeeId={employee.id}
          readOnly={!isManagerView}
          assigneeOptions={[
            { id: employee.id, name: employee.name },
            ...(mgr?.manager && mgr.manager.id !== employee.id
              ? [{ id: mgr.manager.id, name: mgr.manager.name }]
              : []),
          ]}
        />
      </Card>

      {/* 1:1 meeting — managed from the Dashboard board; runnable once scheduled */}
      {isManagerView && mgr?.submittedAt && (
        <Card>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-ink">1:1 Meeting</p>
              <p className="text-xs text-ink-3">
                Status: {mgr.meetingStatus ? mgr.meetingStatus.replaceAll("_", " ").toLowerCase() : "not ready"}
              </p>
            </div>
            {mgr.meetingStatus === "MEETING_SCHEDULED" ? (
              <Button size="sm" onClick={() => window.open(`/meeting/${mgr.id}`, "_blank", "noopener")}>
                Open Meeting
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => router.push("/dashboard")}>
                Go to Board
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit trail (manager/admin only) */}
      {isManagerView && mgr?.id && <AuditTrail assessmentId={mgr.id} />}

      {!self?.submittedAt && !mgr?.submittedAt && (
        <Card>
          <CardContent>
            <p className="text-sm text-ink-3 py-4 text-center">
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

      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50">
          <div className="bg-paper border border-line rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="eyebrow mb-1">Confirm</div>
            <h3 className="serif text-xl text-ink mb-3">Send Results to {employee.name}?</h3>
            {mgr?.meetingStatus !== "MEETING_COMPLETE" && (
              <div className="rounded-lg bg-paper-2 border border-amber/40 p-3 mb-4">
                <p className="text-sm text-ink font-medium mb-1">Important</p>
                <p className="text-sm text-ink-2">
                  Manager reviews should only be sent after the quarterly 1:1 meeting has been conducted. Please confirm you have completed the 1:1 before sharing results.
                </p>
              </div>
            )}
            <p className="text-sm text-ink-2 mb-4">
              This closes out the cycle for {employee.name}: your assessment is locked and the card moves to Review Complete. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowSendConfirm(false)}>Cancel</Button>
              <Button size="sm" variant="magenta" onClick={handleSendResults} disabled={sendingResults}>
                {sendingResults ? "Sending..." : "Confirm & Send Results"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
