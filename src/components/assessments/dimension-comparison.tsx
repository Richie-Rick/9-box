"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getRatingColor } from "@/lib/utils";
import type { ComparisonRow } from "@/lib/comparison";

function defaultLabelFn(r: number): string {
  switch (r) {
    case 1: return "Below";
    case 2: return "Meeting";
    case 3: return "Exceeding";
    default: return String(r);
  }
}

function RatingBadge({ rating, labels }: { rating: number | null; labels?: Record<number, string> }) {
  if (!rating) return <Badge className="bg-gray-100 text-gray-400 border-gray-200">-</Badge>;
  return <Badge className={getRatingColor(rating)}>{labels?.[rating] ?? defaultLabelFn(rating)}</Badge>;
}

interface DimensionComparisonProps {
  rows: ComparisonRow[];
  showManagerColumn?: boolean;
  /** Open every expandable row (meeting mode). */
  expandAll?: boolean;
}

export function DimensionComparison({ rows, showManagerColumn = true, expandAll = false }: DimensionComparisonProps) {
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasText = (row: ComparisonRow) =>
    (row.selfText?.length ?? 0) > 0 || (showManagerColumn && (row.managerText?.length ?? 0) > 0);

  return (
    <div className="divide-y divide-gray-100">
      {rows.map((row, index) => {
        const expandable = hasText(row);
        const isOpen = expandAll ? expandable : openRows.has(row.id);
        const showSectionHeading = index === 0 || rows[index - 1].sectionTitle !== row.sectionTitle;

        return (
          <div key={row.id}>
            {showSectionHeading && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 pt-3 pb-1 px-1">{row.sectionTitle}</p>
            )}
            <button
              type="button"
              onClick={() => expandable && !expandAll && toggle(row.id)}
              className={`w-full flex items-center justify-between py-3 px-1 ${expandable && !expandAll ? "cursor-pointer hover:bg-gray-50" : "cursor-default"}`}
            >
              <span className="text-sm font-medium text-visory-navy text-left">{row.label}</span>
              <div className="flex items-center gap-3">
                {(row.selfRating !== null || row.managerRating !== null) && (
                  <>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Self</p>
                      <RatingBadge rating={row.selfRating} labels={row.labels} />
                    </div>
                    {showManagerColumn && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Manager</p>
                        <span className="inline-flex items-center gap-1">
                          {row.managerInitialRating !== undefined && row.managerInitialRating !== null && (
                            <>
                              <span className="line-through text-xs text-gray-400" title="Initial rating before reading the self-review">
                                {row.labels?.[row.managerInitialRating] ?? defaultLabelFn(row.managerInitialRating)}
                              </span>
                              <span className="text-xs text-gray-400">to</span>
                            </>
                          )}
                          <RatingBadge rating={row.managerRating} labels={row.labels} />
                        </span>
                      </div>
                    )}
                  </>
                )}
                {expandable && !expandAll && (
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
            </button>

            {isOpen && expandable && (
              <div className="pb-4 px-1">
                <div className={`grid gap-4 ${showManagerColumn ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                  {row.selfText && row.selfText.length > 0 && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                      <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Self-Assessment</p>
                      <div className="space-y-2">
                        {row.selfText.map((t, i) => (
                          <div key={i}>
                            <p className="text-xs text-gray-500">{t.label}</p>
                            <p className="text-sm text-visory-navy whitespace-pre-wrap">{t.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {showManagerColumn && row.managerText && row.managerText.length > 0 && (
                    <div className="rounded-lg bg-purple-50 border border-purple-100 p-3">
                      <p className="text-xs font-semibold text-purple-700 uppercase mb-2">Manager Assessment</p>
                      <div className="space-y-2">
                        {row.managerText.map((t, i) => (
                          <div key={i}>
                            <p className="text-xs text-gray-500">{t.label}</p>
                            <p className="text-sm text-visory-navy whitespace-pre-wrap">{t.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
