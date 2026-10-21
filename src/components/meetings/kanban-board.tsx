"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { MultiSelect } from "@/components/ui/multi-select";
import { ShareModal } from "@/components/assessments/share-modal";
import {
  MEETING_STATUS_LABELS,
  MANAGER_SETTABLE_STATUSES,
  getColumnTracking,
} from "@/lib/meeting";
import { getTenureBucket, TENURE_BUCKETS } from "@/lib/tenure";
import { cycleDueDates, formatDueDate, type CycleDueDates } from "@/lib/utils";
import type { TeamMemberStatus, MeetingStatus, CycleData } from "@/types";

type ChipVariant = "default" | "magenta" | "navy" | "success" | "slate" | "warning";

// The board adds a terminal "Review Complete" column beyond the meeting
// statuses: a card lands there once results have been sent (cycle closed).
type ColumnKey = MeetingStatus | "REVIEW_COMPLETE";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "NOT_READY", label: MEETING_STATUS_LABELS.NOT_READY },
  { key: "READY_TO_MEET", label: MEETING_STATUS_LABELS.READY_TO_MEET },
  { key: "MEETING_SCHEDULED", label: MEETING_STATUS_LABELS.MEETING_SCHEDULED },
  { key: "MEETING_COMPLETE", label: MEETING_STATUS_LABELS.MEETING_COMPLETE },
  { key: "REVIEW_COMPLETE", label: "Review Complete" },
];

// Map each column to a design-token badge variant (magenta carries "critical";
// no second loud color). Used for the per-column count chip.
function columnVariant(key: ColumnKey): ChipVariant {
  switch (key) {
    case "READY_TO_MEET":
      return "navy";
    case "MEETING_SCHEDULED":
      return "warning";
    case "MEETING_COMPLETE":
      return "success";
    case "REVIEW_COMPLETE":
      return "success";
    case "NOT_READY":
    default:
      return "slate";
  }
}

// Tracking indicator (on track / due soon / overdue / done) rendered in tokens.
// Magenta doubles as the danger/overdue accent — no separate red.
const TRACKING_DISPLAY: Record<
  ReturnType<typeof getColumnTracking>,
  { label: string; icon: string; className: string }
> = {
  on_track: { label: "On track", icon: "●", className: "text-success" },
  due_soon: { label: "Due soon", icon: "◐", className: "text-amber" },
  overdue: { label: "Overdue", icon: "▲", className: "text-magenta" },
  done: { label: "Complete", icon: "✓", className: "text-success" },
};

function memberColumn(m: TeamMemberStatus): ColumnKey {
  if (m.resultsSentAt) return "REVIEW_COMPLETE";
  return m.meetingStatus ?? "NOT_READY";
}

function openMeeting(assessmentId: string) {
  window.open(`/meeting/${assessmentId}`, "_blank", "noopener");
}

function CompletionDot({ done, label }: { done: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 tiny" title={`${label}: ${done ? "Done" : "Pending"}`}>
      <span className={done ? "text-success" : "text-line-2"}>{done ? "●" : "○"}</span>
      <span className="muted">{label}</span>
    </span>
  );
}

function CardBody({ member, onOpenProfile }: { member: TeamMemberStatus; onOpenProfile?: (id: string) => void }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Avatar name={member.name} size="sm" />
      <div className="min-w-0">
        {onOpenProfile ? (
          <button
            type="button"
            // Stop the pointer event from reaching the drag handle so the name
            // acts as a plain link to the profile instead of starting a drag.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onOpenProfile(member.id)}
            className="text-left text-sm font-medium text-ink hover:text-magenta hover:underline"
          >
            {member.name}
          </button>
        ) : (
          <p className="text-sm font-medium text-ink">{member.name}</p>
        )}
        {member.jobTitle && <p className="tiny muted">{member.jobTitle}</p>}
      </div>
    </div>
  );
}

function MemberCard({
  member,
  column,
  due,
  now,
  onOpenProfile,
  onSendResults,
  onShare,
  onAssess,
}: {
  member: TeamMemberStatus;
  column: ColumnKey;
  due: CycleDueDates | null;
  now: number;
  onOpenProfile: (id: string) => void;
  onSendResults: (member: TeamMemberStatus) => void;
  onShare: (member: TeamMemberStatus) => void;
  onAssess: (member: TeamMemberStatus) => void;
}) {
  const closed = column === "REVIEW_COMPLETE";
  const settable = MANAGER_SETTABLE_STATUSES.includes(column as MeetingStatus);
  // NOT_READY cards are draggable too, but only into Ready to Meet (override);
  // dropping elsewhere is ignored in handleDragEnd.
  const draggable = (settable || column === "NOT_READY") && !closed;

  // The manager assessment stays reachable from every column: a submitted
  // review can be re-opened and edited (audited) until results are sent, and
  // after that the assess page offers Unlock & edit.
  const mgrSubmitted = member.managerAssessmentStatus === "submitted";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: member.id,
    disabled: !draggable,
  });

  const tracking = due ? getColumnTracking(column, due, new Date(now)) : null;
  const tMeta = tracking ? TRACKING_DISPLAY[tracking] : null;

  return (
    <div
      ref={setNodeRef}
      // The DragOverlay (below) is what follows the cursor while dragging, so the
      // source card must stay put — only dim it. Applying the drag transform here
      // too made the original tile jump on pickup ("doesn't cleanly select").
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`card ${draggable ? "card-hover" : ""} p-2.5 ${closed ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div
          {...(draggable ? { ...attributes, ...listeners } : {})}
          className={`min-w-0 flex-1 ${draggable ? "cursor-grab active:cursor-grabbing touch-none" : ""}`}
        >
          <CardBody member={member} onOpenProfile={onOpenProfile} />
        </div>
        {tMeta && (
          <span className={`shrink-0 text-xs leading-5 ${tMeta.className}`} title={tMeta.label}>
            {tMeta.icon}
          </span>
        )}
      </div>

      {/* Self / manager completion icons while still in assessment */}
      {column === "NOT_READY" && (
        <div className="mt-1.5 flex items-center gap-2.5">
          <CompletionDot done={member.selfAssessmentStatus === "submitted"} label="Self" />
          <CompletionDot done={member.managerAssessmentStatus === "submitted"} label="Mgr" />
        </div>
      )}

      {/* Assess CTA — kick off, continue, or edit the manager assessment */}
      <div className="mt-3">
        <Button
          variant={mgrSubmitted || closed ? "secondary" : "magenta"}
          size="sm"
          onClick={() => onAssess(member)}
        >
          {closed
            ? "View assessment"
            : mgrSubmitted
              ? "Edit assessment"
              : member.managerAssessmentStatus === "draft"
                ? "Continue assessment"
                : "Assess"}
        </Button>
      </div>

      {closed ? (
        <div className="mt-3">
          <Badge variant="success">Closed · Results Sent</Badge>
        </div>
      ) : (
        column !== "NOT_READY" &&
        member.managerAssessmentId && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Share the review ahead of the 1:1 so the employee can prepare. */}
            {mgrSubmitted && !member.sharedAt && column !== "MEETING_COMPLETE" && (
              <Button variant="secondary" size="sm" onClick={() => onShare(member)}>
                Share review
              </Button>
            )}
            {member.sharedAt && <Badge variant="navy">Shared</Badge>}
            {column === "MEETING_SCHEDULED" && (
              <Button variant="secondary" size="sm" onClick={() => openMeeting(member.managerAssessmentId!)}>
                {member.meetingStarted ? "Edit Meeting Notes" : "Start Meeting"}
              </Button>
            )}
            {column === "MEETING_COMPLETE" && (
              <Button variant="magenta" size="sm" onClick={() => onSendResults(member)}>
                Send Results
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}

function Column({
  column,
  label,
  members,
  due,
  now,
  dueDate,
  onOpenProfile,
  onSendResults,
  onShare,
  onAssess,
}: {
  column: ColumnKey;
  label: string;
  members: TeamMemberStatus[];
  due: CycleDueDates | null;
  now: number;
  dueDate: Date | null;
  onOpenProfile: (id: string) => void;
  onSendResults: (member: TeamMemberStatus) => void;
  onShare: (member: TeamMemberStatus) => void;
  onAssess: (member: TeamMemberStatus) => void;
}) {
  // Only the three meeting statuses accept drops; NOT_READY and the terminal
  // REVIEW_COMPLETE column do not.
  const droppable = MANAGER_SETTABLE_STATUSES.includes(column as MeetingStatus);
  const { setNodeRef, isOver } = useDroppable({ id: column, disabled: !droppable });
  // Keep columns compact; once a column holds more than 5 cards it scrolls.
  const scroll = members.length > 5;

  return (
    <div className="flex-1 min-w-[210px]">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="min-w-0">
          <span className="eyebrow">{label}</span>
          {dueDate && <p className="tiny muted mono tnum">by {formatDueDate(dueDate)}</p>}
        </div>
        <Badge variant={columnVariant(column)}><span className="mono tnum">{members.length}</span></Badge>
      </div>
      <div
        ref={setNodeRef}
        className={`rounded-lg p-2 space-y-2 min-h-[140px] border transition-colors ${
          scroll ? "max-h-[26rem] overflow-y-auto" : ""
        } ${isOver && droppable ? "bg-magenta/5 border-magenta" : "bg-paper-2 border-line"}`}
      >
        {members.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            column={column}
            due={due}
            now={now}
            onOpenProfile={onOpenProfile}
            onSendResults={onSendResults}
            onShare={onShare}
            onAssess={onAssess}
          />
        ))}
        {members.length === 0 && <p className="tiny muted text-center py-4">None</p>}
      </div>
    </div>
  );
}

function SendResultsModal({ memberName, onConfirm, onCancel, busy }: { memberName: string; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4">
      <div className="card max-w-md w-full p-6 shadow-xl">
        <div className="eyebrow mb-2">Confirm</div>
        <h3 className="serif text-xl mb-2">Send results to {memberName}?</h3>
        <p className="text-sm muted-2 mb-4">
          This closes out the cycle for {memberName}: the manager assessment becomes visible to them and the card moves to Review Complete. This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="magenta" size="sm" onClick={onConfirm} disabled={busy}>{busy ? "Sending…" : "Confirm & Send"}</Button>
        </div>
      </div>
    </div>
  );
}

function OverrideModal({
  memberName,
  reason,
  onConfirm,
  onCancel,
}: {
  memberName: string;
  reason: "incomplete" | "no-mgr-assessment";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const blocked = reason === "no-mgr-assessment";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4">
      <div className="card max-w-md w-full p-6 shadow-xl">
        <div className="eyebrow mb-2">{blocked ? "Can’t move yet" : "Override"}</div>
        <h3 className="serif text-xl mb-2">Move {memberName} to Ready to Meet?</h3>
        {blocked ? (
          <p className="text-sm muted-2 mb-4">
            No manager assessment has been started for {memberName} yet, so there’s no meeting to
            schedule. Start the manager assessment first, then move the card.
          </p>
        ) : (
          <p className="text-sm muted-2 mb-4">
            The self-assessment and/or manager assessment for {memberName} hasn’t been completed.
            Normally a card only reaches Ready to Meet once both are submitted. Move it anyway?
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {blocked ? "Close" : "Cancel"}
          </Button>
          {!blocked && (
            <Button variant="magenta" size="sm" onClick={onConfirm}>
              Override &amp; Move
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CycleTimeline({ due }: { due: CycleDueDates }) {
  // Lazy init so "now" is sampled once, off the render path.
  const [now] = useState(() => Date.now());
  const milestones = [
    { label: "Ready to Meet", date: due.readyToMeet },
    { label: "Meeting Complete", date: due.meetingComplete },
    { label: "Results & Review", date: due.resultsSent },
  ];
  return (
    <div className="rounded-lg border border-line bg-paper px-4 py-3">
      <p className="eyebrow mb-3">Cycle Timeline</p>
      <div className="flex items-center">
        {milestones.map((m, i) => {
          const passed = now > m.date.getTime();
          return (
            <div key={m.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center text-center">
                <span className={`w-3 h-3 rounded-full ${passed ? "bg-success" : "bg-magenta"}`} />
                <span className="text-xs font-medium text-ink mt-1 whitespace-nowrap">{m.label}</span>
                <span className="tiny muted mono tnum">by {formatDueDate(m.date)}</span>
              </div>
              {i < milestones.length - 1 && <div className="flex-1 h-0.5 bg-line mx-2 mt-[-22px]" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KanbanBoard({ members, cycle }: { members: TeamMemberStatus[]; cycle?: CycleData | null }) {
  const router = useRouter();
  const cycleId = cycle?.id ?? null;
  const [items, setItems] = useState<TeamMemberStatus[]>(members);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedTenures, setSelectedTenures] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<TeamMemberStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [shareTarget, setShareTarget] = useState<TeamMemberStatus | null>(null);
  const [sharing, setSharing] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<{
    member: TeamMemberStatus;
    reason: "incomplete" | "no-mgr-assessment";
  } | null>(null);

  // The DragOverlay is portaled to <body> (see below). Gate it behind a mounted
  // flag so it only renders client-side, where document.body exists.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setItems(members);
  }, [members]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const titleOptions = useMemo(
    () => [...new Set(items.map((m) => m.jobTitle).filter(Boolean) as string[])].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((m) => {
      if (selectedTitles.length > 0 && (!m.jobTitle || !selectedTitles.includes(m.jobTitle))) return false;
      if (selectedTenures.length > 0) {
        const bucket = getTenureBucket(m.startDate);
        if (!bucket || !selectedTenures.includes(bucket)) return false;
      }
      return true;
    });
  }, [items, selectedTitles, selectedTenures]);

  const byColumn = useMemo(() => {
    const map: Record<ColumnKey, TeamMemberStatus[]> = {
      NOT_READY: [], READY_TO_MEET: [], MEETING_SCHEDULED: [], MEETING_COMPLETE: [], REVIEW_COMPLETE: [],
    };
    for (const m of filtered) map[memberColumn(m)].push(m);
    return map;
  }, [filtered]);

  async function changeStatus(employeeId: string, status: MeetingStatus, override = false) {
    const member = items.find((m) => m.id === employeeId);
    if (!member?.managerAssessmentId || member.resultsSentAt || member.meetingStatus === status) return;
    const prev = member.meetingStatus;
    setItems((ms) => ms.map((m) => (m.id === employeeId ? { ...m, meetingStatus: status } : m)));
    const res = await fetch("/api/meetings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId: member.managerAssessmentId, meetingStatus: status, override }),
    });
    if (!res.ok) setItems((ms) => ms.map((m) => (m.id === employeeId ? { ...m, meetingStatus: prev } : m)));
  }

  async function confirmSendResults() {
    if (!sendTarget?.managerAssessmentId) return;
    setSending(true);
    try {
      const res = await fetch("/api/assessments/manager/send-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: sendTarget.managerAssessmentId }),
      });
      if (res.ok) {
        const id = sendTarget.id;
        setItems((ms) => ms.map((m) => (m.id === id ? { ...m, resultsSentAt: new Date().toISOString() } : m)));
        setSendTarget(null);
      }
    } finally {
      setSending(false);
    }
  }

  async function confirmShare() {
    if (!shareTarget?.managerAssessmentId) return;
    setSharing(true);
    try {
      const res = await fetch("/api/assessments/manager/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: shareTarget.managerAssessmentId }),
      });
      if (res.ok) {
        const { sharedAt } = await res.json();
        const id = shareTarget.id;
        setItems((ms) => ms.map((m) => (m.id === id ? { ...m, sharedAt } : m)));
        setShareTarget(null);
      }
    } finally {
      setSharing(false);
    }
  }

  // Jump straight into the manager assessment for this report ("kick off the
  // cycle"). The assess page is keyed on employee + cycle and upserts the row,
  // so we only need the cycle id, not an existing managerAssessmentId.
  function openAssessment(member: TeamMemberStatus) {
    if (!cycleId) return;
    router.push(`/assess/${member.id}?cycleId=${cycleId}`);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }
  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const target = over.id as ColumnKey;
    const member = items.find((m) => m.id === active.id);
    if (!member) return;

    // Override path: a card still in NOT_READY ("In Assessment") may only be
    // pulled into Ready to Meet, and only with confirmation / guards.
    if (memberColumn(member) === "NOT_READY") {
      if (target !== "READY_TO_MEET") return;
      if (!member.managerAssessmentId) {
        setOverrideTarget({ member, reason: "no-mgr-assessment" });
        return;
      }
      const bothSubmitted =
        member.selfAssessmentStatus === "submitted" &&
        member.managerAssessmentStatus === "submitted";
      if (bothSubmitted) {
        // Should have auto-advanced already; just move it.
        changeStatus(member.id, "READY_TO_MEET", true);
      } else {
        setOverrideTarget({ member, reason: "incomplete" });
      }
      return;
    }

    if (!MANAGER_SETTABLE_STATUSES.includes(target as MeetingStatus)) return;
    changeStatus(active.id as string, target as MeetingStatus);
  }

  const activeMember = activeId ? items.find((m) => m.id === activeId) : null;

  const dueDates = useMemo(() => (cycle ? cycleDueDates(cycle) : null), [cycle]);
  const now = useMemo(() => Date.now(), []);
  const columnDue: Partial<Record<ColumnKey, Date>> = dueDates
    ? {
        NOT_READY: dueDates.readyToMeet,
        READY_TO_MEET: dueDates.meetingComplete,
        MEETING_SCHEDULED: dueDates.meetingComplete,
        MEETING_COMPLETE: dueDates.resultsSent,
        // Terminal column shares the results deadline so its header keeps a
        // "by <date>" line, matching the other columns and staying aligned.
        REVIEW_COMPLETE: dueDates.resultsSent,
      }
    : {};

  return (
    <div className="space-y-3">
      {dueDates && <CycleTimeline due={dueDates} />}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <MultiSelect label="Titles" options={titleOptions} selected={selectedTitles} onChange={setSelectedTitles} />
        <MultiSelect label="Tenure" options={[...TENURE_BUCKETS]} selected={selectedTenures} onChange={setSelectedTenures} />
      </div>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map(({ key, label }) => (
            <Column
              key={key}
              column={key}
              label={label}
              members={byColumn[key]}
              due={dueDates}
              now={now}
              dueDate={columnDue[key] ?? null}
              onOpenProfile={(id) => router.push(`/team/${id}`)}
              onSendResults={(m) => setSendTarget(m)}
              onShare={(m) => setShareTarget(m)}
              onAssess={openAssessment}
            />
          ))}
        </div>
        {/* Portal the overlay to <body> so its position:fixed is anchored to the
            viewport. Rendered inside an ancestor (the page <main> runs a transform
            animation), a transformed ancestor becomes the containing block and the
            dragged tile drifts away from the cursor. */}
        {mounted &&
          createPortal(
            <DragOverlay>
              {activeMember ? (
                // dnd-kit sizes this overlay's wrapper to the source card's real
                // measured width. Match it with w-full (not a fixed width) and the
                // source card's p-2.5 padding so the visible tile exactly covers the
                // card you grabbed — a hardcoded width left the cursor off the tile
                // whenever the column (flex-1) grew wider than that fixed value.
                <div className="card border-magenta p-2.5 shadow-lg w-full cursor-grabbing">
                  <CardBody member={activeMember} />
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>

      {shareTarget && (
        <ShareModal
          memberName={shareTarget.name}
          selfSubmitted={shareTarget.selfAssessmentStatus === "submitted"}
          busy={sharing}
          onConfirm={confirmShare}
          onCancel={() => setShareTarget(null)}
        />
      )}
      {sendTarget && (
        <SendResultsModal
          memberName={sendTarget.name}
          busy={sending}
          onConfirm={confirmSendResults}
          onCancel={() => setSendTarget(null)}
        />
      )}

      {overrideTarget && (
        <OverrideModal
          memberName={overrideTarget.member.name}
          reason={overrideTarget.reason}
          onCancel={() => setOverrideTarget(null)}
          onConfirm={() => {
            changeStatus(overrideTarget.member.id, "READY_TO_MEET", true);
            setOverrideTarget(null);
          }}
        />
      )}
    </div>
  );
}
