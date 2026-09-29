"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DimensionComparison } from "@/components/assessments/dimension-comparison";
import { GoalsMetricsCard } from "@/components/goals/goals-metrics-card";
import { StageBadge } from "@/components/ui/stage-badge";
import { getBox1Action, getBox2Action, getBox1Color, getBox2Color } from "@/lib/nine-box";
import { formatCyclePeriod } from "@/lib/utils";
import type { ComparisonRow } from "@/lib/comparison";
import type { Stage } from "@/lib/stages";

export interface AgreedActionData {
  id: string;
  text: string;
  done: boolean;
  goal: { id: string; title: string; status: string } | null;
}

interface MeetingViewProps {
  assessmentId: string;
  employee: { id: string; name: string; email: string; jobTitle: string | null; team: string | null };
  cycle: { id: string; month: number; year: number };
  stage: Stage;
  rows: ComparisonRow[];
  box1Label: string | null;
  box2Label: string | null;
  isManager: boolean;
  initialNotes: string;
  oneOnOneCompletedAt: string | null;
  onCompleted: (completedAt: string) => void;
  onExit: () => void;
}

export function MeetingView({
  assessmentId,
  employee,
  cycle,
  stage,
  rows,
  box1Label,
  box2Label,
  isManager,
  initialNotes,
  oneOnOneCompletedAt,
  onCompleted,
  onExit,
}: MeetingViewProps) {
  const [actions, setActions] = useState<AgreedActionData[]>([]);
  const [newAction, setNewAction] = useState("");
  const [notes, setNotes] = useState(initialNotes);
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [completing, setCompleting] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const notesTimer = useRef<number | null>(null);
  const firstName = employee.name.split(" ")[0];

  useEffect(() => {
    fetch(`/api/assessments/manager/actions?assessmentId=${assessmentId}`)
      .then((r) => r.json())
      .then((data) => setActions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [assessmentId]);

  function scheduleNotesSave(value: string) {
    setNotes(value);
    if (!isManager) return;
    setNotesState("saving");
    if (notesTimer.current) window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/assessments/manager/meeting-notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessmentId, notes: value }),
        });
        setNotesState(res.ok ? "saved" : "error");
      } catch {
        setNotesState("error");
      }
    }, 1000);
  }

  async function addAction() {
    const text = newAction.trim();
    if (!text) return;
    setActionError(null);
    const res = await fetch("/api/assessments/manager/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId, text }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionError(data.error || "Could not add action");
      return;
    }
    setActions((a) => [...a, data]);
    setNewAction("");
  }

  async function patchAction(actionId: string, body: Record<string, unknown>) {
    const res = await fetch("/api/assessments/manager/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, ...body }),
    });
    const data = await res.json();
    if (res.ok) setActions((a) => a.map((x) => (x.id === actionId ? data : x)));
    else setActionError(data.error || "Could not update action");
  }

  async function removeAction(actionId: string) {
    const res = await fetch(`/api/assessments/manager/actions?actionId=${actionId}`, { method: "DELETE" });
    if (res.ok) setActions((a) => a.filter((x) => x.id !== actionId));
  }

  async function complete() {
    setCompleting(true);
    try {
      // Flush pending notes first
      if (notesTimer.current) {
        window.clearTimeout(notesTimer.current);
        await fetch("/api/assessments/manager/meeting-notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessmentId, notes }),
        });
      }
      const res = await fetch("/api/assessments/manager/meeting-notes/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });
      const data = await res.json();
      if (res.ok) onCompleted(data.oneOnOneCompletedAt);
    } finally {
      setCompleting(false);
      setConfirmComplete(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 print-break-inside-avoid">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">1:1 meeting · {formatCyclePeriod(cycle.month, cycle.year)}</p>
          <h1 className="text-2xl font-bold text-visory-navy">{employee.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {(employee.jobTitle || employee.team) && (
              <span className="text-sm text-gray-500">{[employee.jobTitle, employee.team].filter(Boolean).join(" · ")}</span>
            )}
            <StageBadge stage={stage} />
            {oneOnOneCompletedAt && (
              <span className="text-xs text-gray-500">
                Held {new Date(oneOnOneCompletedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          {!oneOnOneCompletedAt && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const res = await fetch(`/api/assessments/manager/ics?assessmentId=${assessmentId}`);
                  const data = await res.json();
                  if (data.googleUrl) window.open(data.googleUrl, "_blank", "noopener");
                }}
              >
                Schedule 1:1
              </Button>
              <a
                href={`/api/assessments/manager/ics?assessmentId=${assessmentId}&format=ics`}
                className="text-xs text-gray-500 underline underline-offset-2 hover:text-visory-navy"
              >
                .ics
              </a>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => window.print()}>Print</Button>
          <Button variant="secondary" size="sm" onClick={onExit}>Exit meeting mode</Button>
        </div>
      </div>

      {/* 1. Goals and results */}
      <GoalsMetricsCard employeeId={employee.id} cycleId={cycle.id} variant="compact" canEdit={isManager} title="Goals & results this month" />

      {/* 2. Section-by-section comparison, all expanded */}
      <Card className="print-break-inside-avoid">
        <CardHeader>
          <h2 className="text-lg font-semibold">What you both said</h2>
          <p className="text-xs text-gray-500">Self-assessment, manager assessment and the manager&apos;s responses, section by section</p>
        </CardHeader>
        <CardContent>
          <DimensionComparison rows={rows} expandAll />
        </CardContent>
      </Card>

      {/* 3. Actions */}
      <Card className="print-break-inside-avoid">
        <CardHeader>
          <h2 className="text-lg font-semibold">Actions</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {(box1Label || box2Label) && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Prescribed from the 9-box</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {box1Label && (
                  <div className={`rounded-lg border-2 p-3 ${getBox1Color(box1Label)}`}>
                    <p className="text-xs font-medium text-gray-500 uppercase">Talent Density · {box1Label}</p>
                    <p className="text-sm text-visory-navy mt-1">{getBox1Action(box1Label)}</p>
                  </div>
                )}
                {box2Label && (
                  <div className={`rounded-lg border-2 p-3 ${getBox2Color(box2Label)}`}>
                    <p className="text-xs font-medium text-gray-500 uppercase">Cultural Momentum · {box2Label}</p>
                    <p className="text-sm text-visory-navy mt-1">{getBox2Action(box2Label)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Agreed in the meeting</p>
            {actionError && <p className="text-sm text-red-700 mb-2">{actionError}</p>}
            {actions.length === 0 && <p className="text-sm text-gray-400 mb-2">No agreed actions yet.</p>}
            <ul className="space-y-2">
              {actions.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-2">
                  <input
                    type="checkbox"
                    checked={a.done}
                    onChange={(e) => patchAction(a.id, { done: e.target.checked })}
                    className="mt-1 rounded border-gray-300 text-visory focus:ring-visory"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm text-visory-navy ${a.done ? "line-through text-gray-400" : ""}`}>{a.text}</p>
                    {a.goal && (
                      <Link href={`/team/${employee.id}`} className="text-xs text-visory-link hover:underline">
                        Tracked as goal: {a.goal.title}
                      </Link>
                    )}
                  </div>
                  {isManager && (
                    <div className="flex gap-1 shrink-0 no-print">
                      {!a.goal && (
                        <Button size="sm" variant="ghost" onClick={() => patchAction(a.id, { promote: true })}>Make a goal</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removeAction(a.id)}>Remove</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {isManager && (
              <div className="flex gap-2 mt-3 no-print">
                <input
                  type="text"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAction(); } }}
                  placeholder={`Add an action agreed with ${firstName}...`}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
                />
                <Button size="sm" onClick={addAction} disabled={!newAction.trim()}>Add</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Notes */}
      <Card className="print-break-inside-avoid">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Meeting notes</h2>
            {isManager && (
              <span className="text-xs text-gray-400 no-print">
                {notesState === "saving" ? "Saving..." : notesState === "saved" ? "Saved" : notesState === "error" ? "Not saved, check your connection" : "Autosaves as you type"}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">Visible to {firstName} once the 1:1 is marked complete.</p>
        </CardHeader>
        <CardContent>
          {isManager ? (
            <textarea
              value={notes}
              onChange={(e) => scheduleNotesSave(e.target.value)}
              placeholder="Key takeaways, context shared, what you agreed..."
              rows={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-visory"
            />
          ) : notes ? (
            <p className="text-sm text-visory-navy whitespace-pre-wrap">{notes}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No notes recorded.</p>
          )}
        </CardContent>
      </Card>

      {/* 5. Complete */}
      {isManager && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 no-print">
          <div>
            <p className="text-sm font-medium text-visory-navy">
              {oneOnOneCompletedAt ? "This 1:1 has been marked complete." : "Finished the conversation?"}
            </p>
            <p className="text-xs text-gray-500">
              Marking complete shares the notes and agreed actions with {firstName}.
            </p>
          </div>
          {!oneOnOneCompletedAt && (
            <Button onClick={() => setConfirmComplete(true)} disabled={completing}>Mark 1:1 complete</Button>
          )}
          {oneOnOneCompletedAt && <Badge className="bg-green-100 text-green-800 border-green-300">Complete</Badge>}
        </div>
      )}

      {confirmComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 no-print">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-visory-navy mb-2">Mark the 1:1 with {employee.name} complete?</h3>
            <p className="text-sm text-gray-600 mb-4">
              {firstName} will be able to see your meeting notes and the agreed actions. Your review is shared if it wasn&apos;t already.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setConfirmComplete(false)} disabled={completing}>Cancel</Button>
              <Button size="sm" onClick={complete} disabled={completing}>{completing ? "Saving..." : "Mark complete"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
