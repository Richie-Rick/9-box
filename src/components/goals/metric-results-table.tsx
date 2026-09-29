"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SourceBadge } from "./goals-metrics-card";
import { metricDisconnect } from "@/lib/job-roles";
import type { EffectiveMetric } from "@/lib/job-roles";

interface MetricResultsTableProps {
  employeeId: string;
  cycleId: string;
  /** The performance rating being given; drives the disconnect warning. */
  rating?: number | null;
  /** Bumps when results change elsewhere on the page. */
  refreshKey?: number;
  className?: string;
}

/**
 * Read-only table of this cycle's metric results, shown alongside the
 * performance rating. Warns when the rating sits above the results.
 */
export function MetricResultsTable({ employeeId, cycleId, rating, refreshKey = 0, className }: MetricResultsTableProps) {
  const [metrics, setMetrics] = useState<EffectiveMetric[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/key-metrics?employeeId=${employeeId}&cycleId=${cycleId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMetrics(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setMetrics([]);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, cycleId, refreshKey]);

  if (!metrics || metrics.length === 0) return null;

  const results = metrics.map((m) => m.result).filter((r): r is NonNullable<typeof r> => !!r);
  const { hit, missed, disconnect } = metricDisconnect(rating, results);
  const unrecorded = metrics.length - results.length;

  return (
    <div className={cn("mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 uppercase">Key metrics this month</p>
        <p className="text-xs text-gray-500">
          {hit} hit · {missed} missed{unrecorded > 0 ? ` · ${unrecorded} not recorded` : ""}
        </p>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-200">
          {metrics.map((m) => (
            <tr key={m.id}>
              <td className="py-1.5 pr-2">
                <span className="text-visory-navy">{m.name}</span>{" "}
                <SourceBadge source={m.source} />
              </td>
              <td className="py-1.5 px-2 text-right text-gray-600 whitespace-nowrap">
                {m.target}{m.unit ? ` ${m.unit}` : ""}
              </td>
              <td className="py-1.5 px-2 text-right font-medium text-visory-navy whitespace-nowrap">
                {m.result ? `${m.result.actual}${m.unit ? ` ${m.unit}` : ""}` : <span className="text-gray-400 font-normal">no result</span>}
              </td>
              <td className="py-1.5 pl-2 text-right">
                {m.result?.achieved === true && <Badge className="bg-green-100 text-green-800 border-green-300 text-[10px]">Hit</Badge>}
                {m.result?.achieved === false && <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px]">Missed</Badge>}
                {m.result && m.result.achieved === null && <Badge className="bg-gray-100 text-gray-600 border-gray-300 text-[10px]">Unsure</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {disconnect && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
          This rating is above the metric results ({missed} missed, {hit} hit). Add evidence for the difference, or revisit the rating.
        </div>
      )}
    </div>
  );
}
