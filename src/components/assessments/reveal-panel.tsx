"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Section } from "@/lib/assessment-sections";

export interface RevealState {
  submitted: boolean;
  answers: Record<string, unknown> | null;
}

interface RevealPanelProps {
  employeeName: string;
  section: Section;
  state: RevealState | null;
  canReveal: boolean;
  busy: boolean;
  error?: string | null;
  onReveal: () => void;
}

const DEFAULT_LABELS: Record<number, string> = { 1: "Below", 2: "Meeting", 3: "Exceeding" };

function ratingVariant(rating: number): "success" | "warning" | "magenta" {
  if (rating >= 3) return "success";
  if (rating === 2) return "warning";
  return "magenta";
}

/**
 * Shows the employee's answers for a section once the manager has rated it.
 * Before that it explains what will happen, so the manager rates blind first.
 */
export function RevealPanel({ employeeName, section, state, canReveal, busy, error, onReveal }: RevealPanelProps) {
  const name = employeeName || "the employee";

  if (!state) {
    return (
      <div className="mb-4 rounded-lg border border-navy/20 bg-paper-2 p-3">
        <p className="text-sm font-medium text-ink">What {name} said about {section.title.toLowerCase()}</p>
        <p className="text-xs text-ink-2 mt-1">
          {canReveal
            ? "Your rating for this section is set. Reveal the self-assessment, then write your response."
            : "Rate this section first. The self-assessment is revealed after your rating is saved, so it does not anchor your view."}
        </p>
        {error && <p className="text-xs text-magenta mt-1">{error}</p>}
        <Button size="sm" className="mt-2" onClick={onReveal} disabled={!canReveal || busy}>
          {busy ? "Saving and revealing..." : `Show what ${name} said`}
        </Button>
      </div>
    );
  }

  if (!state.submitted) {
    return (
      <div className="mb-4 rounded-lg border border-line bg-paper-2 p-3">
        <p className="text-sm text-ink-2">
          {name} hasn&apos;t submitted their self-assessment yet. You can submit now and add your response later.
        </p>
      </div>
    );
  }

  const answers = state.answers ?? {};
  const items = section.questions.filter((q) => q.fields.self);

  return (
    <div className="mb-4 rounded-lg bg-paper-2 border-l-2 border-navy p-3">
      <p className="eyebrow text-navy mb-2">What {name} said</p>
      <div className="space-y-2">
        {items.map((q) => {
          const value = answers[q.fields.self!];
          if (q.kind === "rating") {
            const rating = typeof value === "number" ? value : null;
            return (
              <div key={q.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink">{q.label}</span>
                {rating ? (
                  <Badge variant={ratingVariant(rating)}>{(q.labels ?? DEFAULT_LABELS)[rating]}</Badge>
                ) : (
                  <Badge variant="slate">-</Badge>
                )}
              </div>
            );
          }
          if (typeof value !== "string" || !value.trim()) return null;
          return (
            <div key={q.id}>
              <p className="text-xs text-ink-3">{q.sideLabels?.self ?? q.label}</p>
              <p className="text-sm text-ink whitespace-pre-wrap">{value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
