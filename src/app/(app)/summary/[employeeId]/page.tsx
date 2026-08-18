"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { getGrowthReadinessLabel, formatCyclePeriod } from "@/lib/utils";
import {
  getBox1Label,
  getBox2Label,
  getValuesAlignment,
  getBox1Action,
  getBox2Action,
} from "@/lib/nine-box";
import { DimensionComparison } from "@/components/assessments/dimension-comparison";
import { GoalsPanel } from "@/components/assessments/goals-panel";
import { ReviewNotesPanel } from "@/components/assessments/review-notes-panel";
import { ActionsEditor } from "@/components/meetings/actions-editor";

interface SummaryData {
  employee: { id: string; name: string; email: string; jobTitle: string | null; team: string | null; role: string; managerId: string | null };
  cycle: { id: string; month: number | null; quarter: number | null; year: number; status: string } | null;
  selfAssessment: {
    performance: number | null;
    performanceJustification: string | null;
    achievements: string | null;
    blockers: string | null;
    learning: string | null;
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
    notes: string | null;
    submittedAt: string | null;
    resultsSentAt: string | null;
    unlockedAt: string | null;
    meetingStatus: string;
    manager: { id: string; name: string };
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
          managerAssessment: prev.managerAssessment ? { ...prev.managerAssessment, resultsSentAt: new Date().toISOString(), unlockedAt: null } : null,
        } : null);
      }
    } finally {
      setSendingResults(false);
      setShowSendConfirm(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-ink-3">Loading...</div>;
  if (!data || !data.employee) return <div className="text-center py-12 text-ink-3">Summary not found.</div>;

  const { employee, cycle, selfAssessment: self, managerAssessment: mgr } = data;
  const isManagerView = mgr?.manager?.id === session?.user?.id;
  // Whoever currently owns this employee can share results, not just the person
  // who wrote the review — otherwise a departed manager's review can never be
  // re-shared. Mirrors the server rule in the send-results route.
  const isElevated = session?.user?.role === "LEADERSHIP" || session?.user?.role === "ADMIN";
  const canManage = isManagerView || isElevated || employee.managerId === session?.user?.id;
  // An unlocked review is still shared; sending again republishes the edits.
  const awaitingSend = !mgr?.resultsSentAt || !!mgr?.unlockedAt;
  const canSendResults = canManage && mgr?.submittedAt && self?.submittedAt && awaitingSend;
  const isResend = !!mgr?.resultsSentAt && !!mgr?.unlockedAt;

  const mgrValuesAlignment = mgr?.valCustomerFirst && mgr?.valStepIntoArena && mgr?.valFlockToProblems && mgr?.valGiveEnergy
    ? getValuesAlignment(mgr.valCustomerFirst, mgr.valStepIntoArena, mgr.valFlockToProblems, mgr.valGiveEnergy)
    : null;
  const box1Label = mgr?.performance && mgr?.growthReadiness ? getBox1Label(mgr.performance, mgr.growthReadiness) : null;
  const box2Label = mgrValuesAlignment && mgr?.engagement ? getBox2Label(mgrValuesAlignment, mgr.engagement) : null;

  const comparisonSections = [
    {
      id: "performance",
      label: "Performance",
      selfRating: self?.performance ?? null,
      managerRating: mgr?.performance ?? null,
      selfText: [
        { label: "Justification", value: self?.performanceJustification ?? null },
        { label: "Achievements", value: self?.achievements ?? null },
        { label: "Blockers", value: self?.blockers ?? null },
      ],
      managerText: [
        { label: "Evidence", value: mgr?.performanceEvidence ?? null },
      ],
    },
    {
      id: "growthReadiness",
      label: "Growth Readiness",
      selfRating: null,
      managerRating: mgr?.growthReadiness ?? null,
      labelFn: getGrowthReadinessLabel,
      managerText: [
        { label: "Evidence", value: mgr?.growthReadinessEvidence ?? null },
      ],
    },
    {
      id: "valCustomerFirst",
      label: "Customer First",
      selfRating: self?.valCustomerFirst ?? null,
      managerRating: mgr?.valCustomerFirst ?? null,
    },
    {
      id: "valStepIntoArena",
      label: "Step Into the Arena",
      selfRating: self?.valStepIntoArena ?? null,
      managerRating: mgr?.valStepIntoArena ?? null,
    },
    {
      id: "valFlockToProblems",
      label: "Flock to Problems",
      selfRating: self?.valFlockToProblems ?? null,
      managerRating: mgr?.valFlockToProblems ?? null,
    },
    {
      id: "valGiveEnergy",
      label: "Give Energy",
      selfRating: self?.valGiveEnergy ?? null,
      managerRating: mgr?.valGiveEnergy ?? null,
    },
    {
      id: "values",
      label: "Values Reflection",
      selfRating: null,
      managerRating: null,
      selfText: [
        { label: "Reflection", value: self?.valuesReflection ?? null },
      ],
      managerText: [
        { label: "Evidence", value: mgr?.valuesEvidence ?? null },
      ],
    },
    {
      id: "engagement",
      label: "Engagement",
      selfRating: self?.engagement ?? null,
      managerRating: mgr?.engagement ?? null,
      selfText: [
        { label: "Driver", value: self?.engagementDriver ?? null },
        { label: "Support Needed", value: self?.supportNeeded ?? null },
      ],
      managerText: [
        { label: "Evidence", value: mgr?.engagementEvidence ?? null },
      ],
    },
  ];

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
            {mgr?.resultsSentAt && <Badge variant="success">Results Sent</Badge>}
          </span>
        }
        actions={
          canSendResults ? (
            <Button size="sm" variant="magenta" onClick={() => setShowSendConfirm(true)}>
              {isResend ? "Re-send results" : `Send Results to ${employee.name}`}
            </Button>
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
      {(box1Label || box2Label) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {box1Label && (
            <Card navy>
              <p className="eyebrow text-white/70">Talent Density</p>
              <p className="card-title mt-1">{box1Label}</p>
              <p className="text-sm text-white/80 mt-2">{getBox1Action(box1Label)}</p>
            </Card>
          )}
          {box2Label && (
            <Card>
              <p className="eyebrow">Cultural Momentum</p>
              <p className="card-title mt-1">{box2Label}</p>
              <p className="text-sm text-ink-2 mt-2">{getBox2Action(box2Label)}</p>
            </Card>
          )}
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
      {cycle && <GoalsPanel employeeId={employeeId} cycleId={cycle.id} />}

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

      {/* Additional Self-Assessment Context */}
      {self?.submittedAt && (self.learning || self.goalsNextMonth) && (
        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">Self-assessment</div>
              <h2 className="card-title">Additional Context</h2>
            </div>
          </div>
          <CardContent className="space-y-4">
            {self.learning && (
              <div>
                <p className="eyebrow mb-1">Learning</p>
                <p className="text-sm text-ink">{self.learning}</p>
              </div>
            )}
            {self.goalsNextMonth && (
              <div>
                <p className="eyebrow mb-1">Goals for Next Quarter</p>
                <p className="text-sm text-ink">{self.goalsNextMonth}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manager Additional Notes */}
      {mgr?.submittedAt && mgr.notes && (
        <Card>
          <div className="card-head">
            <div>
              <div className="eyebrow">Assessed by {mgr.manager.name}</div>
              <h2 className="card-title">Manager Notes</h2>
            </div>
          </div>
          <CardContent>
            <p className="text-sm text-ink">{mgr.notes}</p>
          </CardContent>
        </Card>
      )}

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

      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50">
          <div className="bg-paper border border-line rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="eyebrow mb-1">Confirm</div>
            <h3 className="serif text-xl text-ink mb-3">
              {isResend ? `Re-send results to ${employee.name}?` : `Send Results to ${employee.name}?`}
            </h3>
            {mgr?.meetingStatus !== "MEETING_COMPLETE" && (
              <div className="rounded-lg bg-paper-2 border border-amber/40 p-3 mb-4">
                <p className="text-sm text-ink font-medium mb-1">Important</p>
                <p className="text-sm text-ink-2">
                  Manager reviews should only be sent after the quarterly 1:1 meeting has been conducted. Please confirm you have completed the 1:1 before sharing results.
                </p>
              </div>
            )}
            <p className="text-sm text-ink-2 mb-4">
              {isResend
                ? `This republishes your edits to ${employee.name}.`
                : `This will make your assessment visible to ${employee.name}.`}{" "}
              You can withdraw results later from the assessment page if you need to.
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
