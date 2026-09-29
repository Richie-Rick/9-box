import { Badge } from "@/components/ui/badge";
import { STAGE_CLASS, STAGE_LABEL, type Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return <Badge className={cn(STAGE_CLASS[stage], className)}>{STAGE_LABEL[stage]}</Badge>;
}
