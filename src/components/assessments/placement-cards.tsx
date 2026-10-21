"use client";

import { Card } from "@/components/ui/card";
import { getBox1Action, getBox2Action } from "@/lib/nine-box";

/**
 * The two 9-box placements (Talent Density, Cultural Momentum) with their
 * prescribed actions. Shared by the summary and meeting pages.
 */
export function PlacementCards({ box1Label, box2Label }: { box1Label: string | null; box2Label: string | null }) {
  if (!box1Label && !box2Label) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {box1Label && (
        <Card navy>
          <p className="eyebrow text-white/70">Talent Density</p>
          <p className="card-title mt-1">{box1Label}</p>
          <p className="text-sm text-white/80 mt-2">{getBox1Action(box1Label)}</p>
        </Card>
      )}
      {box2Label && (
        <Card>
          <p className="eyebrow">Cultural Momentum</p>
          <p className="card-title mt-1">{box2Label}</p>
          <p className="text-sm text-ink-2 mt-2">{getBox2Action(box2Label)}</p>
        </Card>
      )}
    </div>
  );
}
