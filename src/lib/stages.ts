// The lifecycle of one employee's review in one cycle, shown as a single
// badge everywhere (team list, dashboard, admin, summary, board).

export type Stage = "not_started" | "in_progress" | "submitted" | "shared" | "meeting_done";

export const STAGE_ORDER: Stage[] = ["not_started", "in_progress", "submitted", "shared", "meeting_done"];

export const STAGE_LABEL: Record<Stage, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  shared: "Shared",
  meeting_done: "Meeting done",
};

export const STAGE_CLASS: Record<Stage, string> = {
  not_started: "bg-gray-100 text-gray-600 border-gray-300",
  in_progress: "bg-amber-100 text-amber-800 border-amber-300",
  submitted: "bg-blue-100 text-blue-800 border-blue-300",
  shared: "bg-visory-light text-visory-dark border-visory/30",
  meeting_done: "bg-green-100 text-green-800 border-green-300",
};

export interface StageInput {
  selfStarted: boolean;
  selfSubmitted: boolean;
  managerStarted: boolean;
  managerSubmitted: boolean;
  sharedAt: Date | string | null | undefined;
  oneOnOneCompletedAt: Date | string | null | undefined;
}

export function computeStage(input: StageInput): Stage {
  if (input.oneOnOneCompletedAt) return "meeting_done";
  if (input.sharedAt) return "shared";
  if (input.managerSubmitted) return "submitted";
  if (input.selfSubmitted || input.selfStarted || input.managerStarted) return "in_progress";
  return "not_started";
}
