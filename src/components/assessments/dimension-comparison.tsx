"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DimensionSection {
  id: string;
  label: string;
  selfRating: number | null;
  managerRating: number | null;
  labelFn?: (r: number) => string;
  selfText?: { label: string; value: string | null }[];
  managerText?: { label: string; value: string | null }[];
  managerInitial?: number | null;
}

function defaultLabelFn(r: number): string {
  switch (r) {
    case 1: return "Below";
    case 2: return "Meeting";
    case 3: return "Exceeding";
    default: return String(r);
  }
}

function ratingVariant(rating: number): "success" | "warning" | "magenta" {
  if (rating >= 3) return "success";
  if (rating === 2) return "warning";
  return "magenta";
}

function RatingBadge({ rating, labelFn }: { rating: number | null; labelFn: (r: number) => string }) {
  if (!rating) return <Badge variant="slate">-</Badge>;
  return <Badge variant={ratingVariant(rating)}>{labelFn(rating)}</Badge>;
}

export function DimensionComparison({
  sections,
  showManagerColumn = true,
  defaultExpanded = false,
}: {
  sections: DimensionSection[];
  showManagerColumn?: boolean;
  /** Start with every expandable row open (meeting view, print). */
  defaultExpanded?: boolean;
}) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(defaultExpanded ? sections.map((s) => s.id) : [])
  );

  function toggle(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasTextContent = (section: DimensionSection) => {
    const selfHasText = section.selfText?.some((t) => t.value);
    const mgrHasText = section.managerText?.some((t) => t.value);
    return selfHasText || mgrHasText;
  };

  return (
    <div className="divide-y divide-line">
      {sections.map((section) => {
        const isOpen = openSections.has(section.id);
        const expandable = hasTextContent(section);
        const fn = section.labelFn || defaultLabelFn;

        return (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => expandable && toggle(section.id)}
              className={`w-full flex items-center justify-between py-3 px-1 ${expandable ? "cursor-pointer hover:bg-paper-2" : "cursor-default"}`}
            >
              <span className="text-sm font-medium text-ink">{section.label}</span>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="eyebrow mb-1">Self</p>
                  <RatingBadge rating={section.selfRating} labelFn={fn} />
                </div>
                {showManagerColumn && (
                  <div className="text-center">
                    <p className="eyebrow mb-1">Manager</p>
                    <RatingBadge rating={section.managerRating} labelFn={fn} />
                    {section.managerInitial != null && (
                      <p className="tiny text-ink-3 mt-0.5" title="Rating before the self-assessment was revealed">
                        was {fn(section.managerInitial)}
                      </p>
                    )}
                  </div>
                )}
                {expandable && (
                  <ChevronDown
                    size={16}
                    strokeWidth={1.6}
                    className={`text-ink-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </div>
            </button>

            {isOpen && expandable && (
              <div className="pb-4 px-1">
                <div className={`grid gap-4 ${showManagerColumn ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                  {section.selfText && section.selfText.some((t) => t.value) && (
                    <div className="rounded-lg bg-paper-2 border-l-2 border-navy p-3">
                      <p className="eyebrow text-navy mb-2">Self-Assessment</p>
                      <div className="space-y-2">
                        {section.selfText.filter((t) => t.value).map((t, i) => (
                          <div key={i}>
                            <p className="text-xs text-ink-3">{t.label}</p>
                            <p className="text-sm text-ink">{t.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {showManagerColumn && section.managerText && section.managerText.some((t) => t.value) && (
                    <div className="rounded-lg bg-magenta-3 border-l-2 border-magenta p-3">
                      <p className="eyebrow text-magenta-2 mb-2">Manager Assessment</p>
                      <div className="space-y-2">
                        {section.managerText.filter((t) => t.value).map((t, i) => (
                          <div key={i}>
                            <p className="text-xs text-ink-3">{t.label}</p>
                            <p className="text-sm text-ink">{t.value}</p>
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
