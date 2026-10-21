"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ProgressStatus = "ON_TRACK" | "OFF_TRACK" | "COMPLETE";

interface Creator {
  id: string;
  name: string;
}

interface GoalUpdateData {
  id: string;
  status: ProgressStatus;
  note: string | null;
  createdById: string;
  createdBy?: Creator | null;
}

interface GoalData {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  updates?: GoalUpdateData[];
  createdBy?: Creator | null;
}

interface MetricResultData {
  id: string;
  actual: string;
  note: string | null;
}

interface MetricData {
  id: string;
  name: string;
  target: string;
  unit: string | null;
  results?: MetricResultData[];
  createdBy?: Creator | null;
}

// Small badge marking whether a goal/metric was set by the employee themselves
// or by their manager. `subjectId` is the employee the goal/metric belongs to.
function CreatorBadge({ createdBy, subjectId }: { createdBy?: Creator | null; subjectId: string }) {
  if (!createdBy) return null;
  const byEmployee = createdBy.id === subjectId;
  return (
    <Badge variant="slate" className="text-[11px]">
      {byEmployee ? "Set by employee" : "Set by manager"}
    </Badge>
  );
}

const STATUS_LABELS: Record<ProgressStatus, string> = {
  ON_TRACK: "On track",
  OFF_TRACK: "Off track",
  COMPLETE: "Complete",
};

const STATUS_VARIANTS: Record<ProgressStatus, "success" | "warning" | "navy"> = {
  ON_TRACK: "success",
  OFF_TRACK: "warning",
  COMPLETE: "navy",
};

export function GoalsPanel({
  employeeId,
  cycleId,
  editable = false,
  onMetricsStatus,
  className,
  defaultOpen,
  showGoalNotes = true,
  flat = false,
}: {
  employeeId: string;
  cycleId?: string | null;
  editable?: boolean;
  /** Reports how many key metrics exist and how many have a saved actual. */
  onMetricsStatus?: (status: { total: number; complete: number }) => void;
  /** Override the wrapper classes (defaults to a centred, narrow column). */
  className?: string;
  /** Render expanded on first paint regardless of edit mode. */
  defaultOpen?: boolean;
  /** Show the per-goal free-text progress note (status dropdown stays either way). */
  showGoalNotes?: boolean;
  /** Render the content only, without the collapsible header (for embedding in a card). */
  flat?: boolean;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const viewerId = session?.user?.id ?? null;
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(defaultOpen ? false : !editable);
  const [completedMetricIds, setCompletedMetricIds] = useState<Set<string>>(new Set());

  const query = (path: string) =>
    `${path}?employeeId=${employeeId}${cycleId ? `&cycleId=${cycleId}` : ""}`;

  useEffect(() => {
    // A failed request used to be swallowed as an empty list, so the panel
    // silently vanished (B5). Surface the failure instead.
    const load = async (path: string) => {
      const r = await fetch(query(path));
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `Could not load ${path.replace("/api/", "")} (${r.status})`);
      }
      return r.json();
    };
    setLoading(true);
    setLoadError(null);
    Promise.all([load("/api/goals"), load("/api/key-metrics")])
      .then(([g, m]: [GoalData[], MetricData[]]) => {
        // Active goals, plus any goal already reviewed in this cycle.
        setGoals(
          (Array.isArray(g) ? g : []).filter(
            (goal) => goal.status === "ACTIVE" || (goal.updates && goal.updates.length > 0)
          )
        );
        const ms: MetricData[] = Array.isArray(m) ? m : [];
        setMetrics(ms);
        setCompletedMetricIds(
          new Set(ms.filter((metric) => (metric.results?.[0]?.actual ?? "").trim()).map((metric) => metric.id))
        );
        setLoading(false);
      })
      .catch((err: Error) => {
        setLoadError(err.message || "Could not load goals and key metrics");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, cycleId]);

  // Report key-metric completion so a parent can gate on it.
  useEffect(() => {
    onMetricsStatus?.({ total: metrics.length, complete: completedMetricIds.size });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, completedMetricIds]);

  const isEmpty = goals.length === 0 && metrics.length === 0;
  const open = flat || !collapsed;
  // Rows seed their editable state from the viewer's own update, so wait for
  // the session before rendering them.
  const ready = !loading && sessionStatus !== "loading";

  return (
    <div className={className ?? "max-w-2xl mx-auto mb-6"}>
      {!flat && (
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between rounded-lg border border-line bg-paper-2 px-4 py-3 hover:bg-paper transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target size={16} strokeWidth={1.6} className="text-ink-2" />
          <span className="text-sm font-medium text-ink">
            Goals &amp; Key Metrics{editable ? " — Review" : ""}
          </span>
          <Badge variant="slate" className="mono tnum">
            {goals.length + metrics.length}
          </Badge>
        </div>
        <ChevronDown
          size={16}
          strokeWidth={1.6}
          className={`text-ink-3 transition-transform ${collapsed ? "" : "rotate-180"}`}
        />
      </button>
      )}

      {open && (
        <div className={flat ? "space-y-4" : "border border-t-0 border-line rounded-b-lg p-4 space-y-4"}>
          {!ready && !loadError && <p className="text-sm text-ink-3">Loading goals and key metrics...</p>}
          {loadError && <p className="text-sm text-magenta">{loadError}</p>}
          {ready && !loadError && isEmpty && (
            <p className="text-sm text-ink-3">
              No goals or key metrics have been set for this cycle yet.
            </p>
          )}
          {ready && metrics.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Key Metrics</p>
              <div className="space-y-2">
                {metrics.map((m) => (
                  <MetricRow
                    key={m.id}
                    metric={m}
                    cycleId={cycleId}
                    editable={editable}
                    subjectId={employeeId}
                    onSaved={() =>
                      setCompletedMetricIds((prev) => {
                        const next = new Set(prev);
                        next.add(m.id);
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}
          {ready && goals.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Goals</p>
              <div className="space-y-2">
                {goals.map((g) => (
                  <GoalRow key={g.id} goal={g} cycleId={cycleId} editable={editable} subjectId={employeeId} viewerId={viewerId} showGoalNotes={showGoalNotes} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricRow({
  metric,
  cycleId,
  editable,
  subjectId,
  onSaved,
}: {
  metric: MetricData;
  cycleId?: string | null;
  editable: boolean;
  subjectId: string;
  onSaved?: () => void;
}) {
  const existing = metric.results?.[0];
  const [actual, setActual] = useState(existing?.actual ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!cycleId || !actual.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/key-metrics/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyMetricId: metric.id, cycleId, actual, note }),
      });
      if (res.ok) {
        setSaved(true);
        onSaved?.();
        setTimeout(() => setSaved(false), 2000);
      } else {
        const e = await res.json().catch(() => ({}));
        setError(e.error || `Failed to save (${res.status})`);
      }
    } catch {
      setError("Network error while saving");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-ink font-medium truncate">{metric.name}</span>
          <CreatorBadge createdBy={metric.createdBy} subjectId={subjectId} />
        </span>
        <span className="text-ink-2 shrink-0">
          Target: <span className="mono tnum">{metric.target}{metric.unit ? ` ${metric.unit}` : ""}</span>
        </span>
      </div>
      {editable ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              placeholder={`Actual result${metric.unit ? ` (${metric.unit})` : ""}`}
              className="flex-1 rounded-lg border border-line-2 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
            />
            <Button size="sm" onClick={save} disabled={saving || !actual.trim()}>
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
            </Button>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Comment (optional)"
            className="w-full rounded-lg border border-line-2 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
          />
          {error && <p className="text-xs text-magenta">{error}</p>}
        </div>
      ) : (
        existing && (
          <p className="mt-1 text-sm text-ink-2">
            Actual: <span className="font-medium text-ink mono tnum">{existing.actual}</span>
            {existing.note ? ` — ${existing.note}` : ""}
          </p>
        )
      )}
    </div>
  );
}

// Who recorded an update, relative to the goal's owner.
function authorLabel(update: GoalUpdateData, subjectId: string): string {
  if (update.createdById === subjectId) return "Employee";
  return update.createdBy?.name ?? "Manager";
}

function GoalRow({
  goal,
  cycleId,
  editable,
  subjectId,
  viewerId,
  showGoalNotes,
}: {
  goal: GoalData;
  cycleId?: string | null;
  editable: boolean;
  subjectId: string;
  viewerId: string | null;
  showGoalNotes: boolean;
}) {
  // Each author keeps their own update for the cycle. The viewer edits
  // theirs; everyone else's is shown read-only beneath.
  const updates = goal.updates ?? [];
  const existing = updates.find((u) => u.createdById === viewerId);
  const others = updates.filter((u) => u.createdById !== viewerId);
  const [status, setStatus] = useState<ProgressStatus>(existing?.status ?? "ON_TRACK");
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!cycleId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/goals/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goal.id, cycleId, status, note }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        const e = await res.json().catch(() => ({}));
        setError(e.error || `Failed to save (${res.status})`);
      }
    } catch {
      setError("Network error while saving");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink">{goal.title}</p>
            <CreatorBadge createdBy={goal.createdBy} subjectId={subjectId} />
          </div>
          {goal.description && <p className="text-ink-3 text-xs mt-0.5">{goal.description}</p>}
          {goal.dueDate && (
            <p className="text-xs text-ink-3 mt-0.5">
              Due: <span className="mono tnum">{new Date(goal.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </p>
          )}
        </div>
        {!editable && updates.length > 0 && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            {updates.map((u) => (
              <span key={u.id} className="flex items-center gap-1.5">
                <span className="tiny text-ink-3">{authorLabel(u, subjectId)}</span>
                <Badge variant={STATUS_VARIANTS[u.status]}>{STATUS_LABELS[u.status]}</Badge>
              </span>
            ))}
          </div>
        )}
      </div>
      {editable ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProgressStatus)}
              className="rounded-lg border border-line-2 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
            >
              <option value="ON_TRACK">On track</option>
              <option value="OFF_TRACK">Off track</option>
              <option value="COMPLETE">Complete</option>
            </select>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
            </Button>
          </div>
          {showGoalNotes && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Progress update (optional)"
              rows={2}
              className="w-full rounded-lg border border-line-2 bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
            />
          )}
          {error && <p className="text-xs text-magenta">{error}</p>}
          {others.map((u) => (
            <p key={u.id} className="text-xs text-ink-2">
              <span className="font-medium text-ink">{authorLabel(u, subjectId)}:</span>{" "}
              {STATUS_LABELS[u.status]}{u.note ? ` — ${u.note}` : ""}
            </p>
          ))}
        </div>
      ) : (
        showGoalNotes &&
        updates.some((u) => u.note) && (
          <div className="mt-1 space-y-0.5">
            {updates.filter((u) => u.note).map((u) => (
              <p key={u.id} className="text-sm text-ink-2">
                <span className="text-xs font-medium text-ink">{authorLabel(u, subjectId)}:</span> {u.note}
              </p>
            ))}
          </div>
        )
      )}
    </div>
  );
}
