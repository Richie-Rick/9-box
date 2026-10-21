"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MeetingEditor } from "@/components/meetings/meeting-editor";
import { PageHeader } from "@/components/ui/page-header";
import { DimensionComparison } from "@/components/assessments/dimension-comparison";
import { GoalsPanel } from "@/components/assessments/goals-panel";
import { PlacementCards } from "@/components/assessments/placement-cards";
import { ShareModal } from "@/components/assessments/share-modal";
import { buildComparisonRows } from "@/lib/comparison";
import { getBox1Label, getBox2Label, getValuesAlignment } from "@/lib/nine-box";
import { formatCyclePeriod } from "@/lib/utils";

interface AssessmentData {
  id: string;
  employee: { id: string; name: string; email: string };
  manager: { id: string; name: string };
  cycle: { id: string; month: number | null; quarter: number | null; year: number };
  meetingStatus: string;
  submittedAt: string | null;
  sharedAt: string | null;
  resultsSentAt: string | null;
}

interface SummaryData {
  selfAssessment: (Record<string, unknown> & { submittedAt: string | null }) | null;
  managerAssessment:
    | (Record<string, unknown> & {
        performance: number | null;
        growthReadiness: number | null;
        valCustomerFirst: number | null;
        valStepIntoArena: number | null;
        valFlockToProblems: number | null;
        valGiveEnergy: number | null;
        engagement: number | null;
        initialRatings?: Record<string, number> | null;
      })
    | null;
}

/**
 * Everything the manager needs in the room: the 9-box placements and
 * prescribed actions, what both sides said (expanded), the goals and metric
 * results, then the notes and agreed actions. Prints cleanly.
 */
export default function MeetingPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = use(params);
  const router = useRouter();
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetch(`/api/assessments/manager/${assessmentId}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || "Unable to load this meeting");
        }
        return r.json();
      })
      .then(async (d: AssessmentData) => {
        setAssessment(d);
        const res = await fetch(`/api/assessments/summary?employeeId=${d.employee.id}&cycleId=${d.cycle.id}`);
        if (res.ok) setSummary(await res.json());
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [assessmentId]);

  async function confirmShare() {
    if (!assessment) return;
    setSharing(true);
    try {
      const res = await fetch("/api/assessments/manager/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: assessment.id }),
      });
      if (res.ok) {
        const d = await res.json();
        setAssessment({ ...assessment, sharedAt: d.sharedAt });
        setShowShare(false);
      }
    } finally {
      setSharing(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-ink-3">Loading…</div>;
  if (error || !assessment) return <div className="text-center py-12 text-magenta">{error || "Not found"}</div>;

  const assigneeOptions = [
    { id: assessment.employee.id, name: assessment.employee.name },
    { id: assessment.manager.id, name: assessment.manager.name },
  ].filter((o, i, arr) => arr.findIndex((x) => x.id === o.id) === i);

  const self = summary?.selfAssessment ?? null;
  const mgr = summary?.managerAssessment ?? null;
  const mgrValuesAlignment = mgr?.valCustomerFirst && mgr?.valStepIntoArena && mgr?.valFlockToProblems && mgr?.valGiveEnergy
    ? getValuesAlignment(mgr.valCustomerFirst, mgr.valStepIntoArena, mgr.valFlockToProblems, mgr.valGiveEnergy)
    : null;
  const box1Label = mgr?.performance && mgr?.growthReadiness ? getBox1Label(mgr.performance, mgr.growthReadiness) : null;
  const box2Label = mgrValuesAlignment && mgr?.engagement ? getBox2Label(mgrValuesAlignment, mgr.engagement) : null;
  const rows = buildComparisonRows(self, mgr, { initialRatings: mgr?.initialRatings });
  const canShare = !!assessment.submittedAt && !assessment.sharedAt && !assessment.resultsSentAt;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="1:1 meeting"
        title={<>Meeting with <em>{assessment.employee.name}.</em></>}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span className="mono tnum">{formatCyclePeriod(assessment.cycle)}</span>
            {assessment.sharedAt ? (
              <Badge variant="navy">Review shared</Badge>
            ) : (
              <Badge variant="warning">Review not yet shared</Badge>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 no-print">
            {canShare && (
              <Button size="sm" onClick={() => setShowShare(true)}>
                Share review
              </Button>
            )}
            {assessment.meetingStatus !== "MEETING_COMPLETE" && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const res = await fetch(`/api/assessments/manager/ics?assessmentId=${assessment.id}`);
                    const data = await res.json().catch(() => ({}));
                    if (data.googleUrl) window.open(data.googleUrl, "_blank", "noopener");
                  }}
                >
                  Add to Google Calendar
                </Button>
                <a
                  href={`/api/assessments/manager/ics?assessmentId=${assessment.id}&format=ics`}
                  className="text-xs text-ink-2 underline underline-offset-2 hover:text-ink"
                >
                  .ics
                </a>
              </>
            )}
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              Print
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push(`/team/${assessment.employee.id}`)}>
              View Profile
            </Button>
          </div>
        }
      />

      {/* 1. Where they landed, and what the 9-box prescribes */}
      <PlacementCards box1Label={box1Label} box2Label={box2Label} />

      {/* 2. What you both said, every section open */}
      <Card className="print-break-inside-avoid">
        <div className="card-head">
          <div>
            <div className="eyebrow">Self vs manager</div>
            <h2 className="card-title">What you both said</h2>
          </div>
          {!mgr?.submittedAt && <p className="text-xs text-ink-3">Manager assessment not submitted yet</p>}
        </div>
        <CardContent>
          {rows.length > 0 ? (
            <DimensionComparison sections={rows} defaultExpanded />
          ) : (
            <p className="text-sm text-ink-3 py-2">Nothing submitted for this cycle yet.</p>
          )}
        </CardContent>
      </Card>

      {/* 3. Goals and key-metric results for the cycle */}
      <Card className="print-break-inside-avoid">
        <div className="card-head">
          <div>
            <div className="eyebrow">This cycle</div>
            <h2 className="card-title">Goals &amp; key metrics</h2>
          </div>
        </div>
        <CardContent>
          <GoalsPanel employeeId={assessment.employee.id} cycleId={assessment.cycle.id} className="" flat />
        </CardContent>
      </Card>

      {/* 4. Notes and agreed actions */}
      <MeetingEditor
        assessmentId={assessment.id}
        employeeId={assessment.employee.id}
        assigneeOptions={assigneeOptions}
      />

      {showShare && (
        <ShareModal
          memberName={assessment.employee.name}
          selfSubmitted={!!self?.submittedAt}
          busy={sharing}
          onConfirm={confirmShare}
          onCancel={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
