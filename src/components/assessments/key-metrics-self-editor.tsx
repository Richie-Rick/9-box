"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MetricData {
  id: string;
  name: string;
  target: string;
  unit: string | null;
  templateId?: string | null;
  createdBy?: { id: string; name: string } | null;
}

/**
 * Lets an employee view and set their own key metrics. Metrics set by their
 * manager are listed too (labelled accordingly); the employee can only remove
 * metrics they created themselves.
 */
export function KeyMetricsSelfEditor({ employeeId }: { employeeId: string }) {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/key-metrics?employeeId=${employeeId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setMetrics(data);
      })
      .finally(() => setLoading(false));
  }, [employeeId]);

  async function addMetric() {
    if (!name.trim() || !target.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/key-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          name: name.trim(),
          target: target.trim(),
          unit: unit.trim() || null,
        }),
      });
      if (res.ok) {
        const metric = await res.json();
        setMetrics((prev) => [metric, ...prev]);
        setName("");
        setTarget("");
        setUnit("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeMetric(metricId: string) {
    const res = await fetch(`/api/key-metrics?metricId=${metricId}`, { method: "DELETE" });
    if (res.ok) setMetrics((prev) => prev.filter((m) => m.id !== metricId));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-3">
        Set the key metrics you want to be measured against. Metrics your manager set are listed here too.
      </p>

      {!loading && metrics.length > 0 && (
        <div className="space-y-2">
          {metrics.map((m) => {
            const byEmployee = !m.templateId && (m.createdBy ? m.createdBy.id === employeeId : true);
            return (
              <div key={m.id} className="flex items-start justify-between rounded-lg border border-line px-3 py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">{m.name}</p>
                    {m.templateId ? (
                      <Badge variant="navy" className="text-[11px]">Role-set</Badge>
                    ) : (
                      <Badge variant="slate" className="text-[11px]">
                        {byEmployee ? "Set by employee" : "Set by manager"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-3">
                    Target: <span className="mono tnum">{m.target}{m.unit ? ` ${m.unit}` : ""}</span>
                  </p>
                </div>
                {byEmployee && (
                  <Button size="sm" variant="ghost" className="text-[11px] px-2 py-1" onClick={() => removeMetric(m.id)}>
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-line p-3 space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Metric name (e.g. Tickets resolved)"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
        />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target"
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
          />
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit (optional)"
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-magenta"
          />
          <Button size="sm" onClick={addMetric} disabled={saving || !name.trim() || !target.trim()}>
            {saving ? "Adding..." : "Add Metric"}
          </Button>
        </div>
      </div>
    </div>
  );
}
