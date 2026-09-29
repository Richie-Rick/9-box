"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCyclePeriod } from "@/lib/utils";
import { buildComparisonRows } from "@/lib/comparison";
import { GoalsMetricsCard } from "@/components/goals/goals-metrics-card";
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
  resultsSentAt: string | null;
  oneOnOneComplete: boolean;
  oneOnOneNotes: string | null;
  oneOnOneCompletedAt: string | null;
  manager: { id: string; name: string };
}

export default function SummaryPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params);
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const cycleId = searchParams.get("cycleId");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendingResults, setSendingResults] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (!cycleId) return;
    fetch(`/api/assessments/summary?employeeId=${employeeId}&cycleId=${cycleId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d.managerAssessment?.oneOnOneNotes) {
          setMeetingNotes(d.managerAssessment.oneOnOneNotes);
        }
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

  async function handleSaveMeetingNotes() {
    if (!data?.managerAssessment?.id) return;
    setSavingNotes(true);
    try {
      const res = await fetch("/api/assessments/manager/meeting-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: data.managerAssessment.id, notes: meetingNotes }),
      });
      if (res.ok) {
        setData((prev) => prev ? {
          ...prev,
          managerAssessment: prev.managerAssessment ? {
            ...prev.managerAssessment,
            oneOnOneComplete: true,
            oneOnOneNotes: meetingNotes,
            oneOnOneCompletedAt: new Date().toISOString(),
          } : null,
        } : null);
        setEditingNotes(false);
      }
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!data || !data.employee) return <div className="text-center py-12 text-gray-500">Summary not found.</div>;

  const { employee, cycle, selfAssessment: self, managerAssessment: mgr } = data;
  const isManagerView = mgr?.manager?.id === session?.user?.id;
  const canSendResults = isManagerView && mgr?.submittedAt && self?.submittedAt && !mgr?.resultsSentAt;

  const mgrValuesAlignment = mgr?.valCustomerFirst && mgr?.valStepIntoArena && mgr?.valFlockToProblems && mgr?.valGiveEnergy
    ? getValuesAlignment(mgr.valCustomerFirst, mgr.valStepIntoArena, mgr.valFlockToProblems, mgr.valGiveEnergy)
    : null;
  const box1Label = mgr?.performance && mgr?.growthReadiness ? getBox1Label(mgr.performance, mgr.growthReadiness) : null;
  const box2Label = mgrValuesAlignment && mgr?.engagement ? getBox2Label(mgrValuesAlignment, mgr.engagement) : null;

  const comparisonRows = buildComparisonRows(self, mgr, { initialRatings: mgr?.initialRatings ?? null });
  const isLeadership = session?.user?.role === "LEADERSHIP" || session?.user?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-visory-navy">{employee.name}</h1>
        {(employee.jobTitle || employee.team) && (
          <p className="text-sm text-gray-500 mt-0.5">
            {[employee.jobTitle, employee.team].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <p className="text-sm text-gray-600">
            Assessment Summary {cycle ? `— ${formatCyclePeriod(cycle.month, cycle.year)}` : ""}
          </p>
          {mgr?.resultsSentAt && (
            <Badge className="bg-green-100 text-green-800 border-green-300">Results Sent</Badge>
          )}
        </div>
        {canSendResults && (
          <Button className="mt-3" size="sm" onClick={() => setShowSendConfirm(true)}>
            Send Results to {employee.name}
          </Button>
        )}
      </div>

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

      {/* 1:1 Meeting Notes (manager-only) */}
      {isManagerView && mgr?.submittedAt && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">1:1 Meeting Notes</h2>
                {mgr.oneOnOneCompletedAt && (
                  <p className="text-xs text-gray-500">
                    Completed {new Date(mgr.oneOnOneCompletedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>
              {mgr.oneOnOneComplete && !editingNotes && (
                <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {mgr.oneOnOneComplete && !editingNotes ? (
              <div>
                {mgr.oneOnOneNotes ? (
                  <p className="text-sm text-visory-navy whitespace-pre-wrap">{mgr.oneOnOneNotes}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No notes recorded.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Record any context from your 1:1 meeting. Scores will not be changed.
                </p>
                <textarea
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  placeholder="Key takeaways, context shared, actions agreed..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory focus:border-visory"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveMeetingNotes} disabled={savingNotes}>
                    {savingNotes ? "Saving..." : "Save Meeting Notes"}
                  </Button>
                  {editingNotes && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditingNotes(false); setMeetingNotes(mgr.oneOnOneNotes || ""); }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
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

      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-visory-navy mb-2">Send Results to {employee.name}?</h3>
            {!mgr?.oneOnOneComplete && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
                <p className="text-sm text-amber-800 font-semibold mb-1">Important</p>
                <p className="text-sm text-amber-700">
                  Manager reviews should only be sent after the monthly 1:1 meeting has been conducted. Please confirm you have completed the 1:1 before sharing results.
                </p>
              </div>
            )}
            <p className="text-sm text-gray-600 mb-4">
              This will make your assessment visible to {employee.name}. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowSendConfirm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSendResults} disabled={sendingResults}>
                {sendingResults ? "Sending..." : "Confirm & Send Results"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
