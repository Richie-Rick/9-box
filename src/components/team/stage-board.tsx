"use client";

import { Button } from "@/components/ui/button";
import { STAGE_LABEL, STAGE_ORDER, type Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

export interface BoardCard {
  id: string;
  name: string;
  subtitle?: string | null;
  stage: Stage;
  selfStatus?: "not_started" | "draft" | "submitted";
  managerStatus?: "not_started" | "draft" | "submitted";
  /** Buttons rendered on the card; the board decides nothing about actions. */
  actions?: React.ReactNode;
  href?: string;
}

interface StageBoardProps {
  cards: BoardCard[];
  onOpen?: (card: BoardCard) => void;
  emptyText?: string;
}

const COLUMN_CLASS: Record<Stage, string> = {
  not_started: "border-gray-200 bg-gray-50",
  in_progress: "border-amber-200 bg-amber-50/60",
  submitted: "border-blue-200 bg-blue-50/60",
  shared: "border-visory/30 bg-visory-light",
  meeting_done: "border-green-200 bg-green-50/60",
};

/** Team members laid out by review stage. No drag and drop; stage is derived from data. */
export function StageBoard({ cards, onOpen, emptyText = "No one to show." }: StageBoardProps) {
  if (cards.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <div className="grid grid-flow-col auto-cols-[minmax(200px,1fr)] gap-3 min-w-[900px]">
        {STAGE_ORDER.map((stage) => {
          const column = cards.filter((c) => c.stage === stage);
          return (
            <div key={stage} className={cn("rounded-lg border p-2 min-h-[160px]", COLUMN_CLASS[stage])}>
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-visory-navy">{STAGE_LABEL[stage]}</p>
                <span className="text-xs text-gray-500">{column.length}</span>
              </div>
              <div className="space-y-2">
                {column.map((card) => (
                  <div key={card.id} className="rounded-lg bg-white border border-gray-200 shadow-sm p-2.5">
                    <button
                      type="button"
                      onClick={() => onOpen?.(card)}
                      className="text-left w-full"
                    >
                      <p className="text-sm font-medium text-visory-navy hover:underline">{card.name}</p>
                      {card.subtitle && <p className="text-[11px] text-gray-500 truncate">{card.subtitle}</p>}
                    </button>
                    {(card.selfStatus || card.managerStatus) && (
                      <div className="flex gap-2 mt-1.5 text-[10px] text-gray-500">
                        {card.selfStatus && (
                          <span className={cn("rounded-full px-1.5 py-0.5 border", card.selfStatus === "submitted" ? "bg-green-50 border-green-200 text-green-700" : card.selfStatus === "draft" ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-gray-50 border-gray-200")}>
                            Self {card.selfStatus === "submitted" ? "in" : card.selfStatus === "draft" ? "draft" : "pending"}
                          </span>
                        )}
                        {card.managerStatus && (
                          <span className={cn("rounded-full px-1.5 py-0.5 border", card.managerStatus === "submitted" ? "bg-green-50 border-green-200 text-green-700" : card.managerStatus === "draft" ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-gray-50 border-gray-200")}>
                            Mgr {card.managerStatus === "submitted" ? "in" : card.managerStatus === "draft" ? "draft" : "pending"}
                          </span>
                        )}
                      </div>
                    )}
                    {card.actions && <div className="flex flex-wrap gap-1 mt-2">{card.actions}</div>}
                  </div>
                ))}
                {column.length === 0 && <p className="text-[11px] text-gray-400 px-1">Nobody here</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BoardAction({ children, onClick, variant = "secondary" }: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <Button size="sm" variant={variant} className="px-2 py-1 text-xs" onClick={onClick}>
      {children}
    </Button>
  );
}
