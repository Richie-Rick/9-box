// 9-Box Grid Logic
// Rating scale: 1 = Low, 2 = Medium, 3 = High

// Box 1: Performance x Growth Readiness
const BOX1_LABELS: Record<string, string> = {
  "1-3": "Remove the Blockers",
  "2-3": "Stretch & Develop",
  "3-3": "Ready to Promote",
  "1-2": "Build the Foundations",
  "2-2": "Keep Growing",
  "3-2": "Expand the Role",
  "1-1": "Intervene Now",
  "2-1": "Maintain & Recognise",
  "3-1": "Deepen the Expertise",
};

// Box 2: Values Alignment x Engagement
const BOX2_LABELS: Record<string, string> = {
  "1-3": "Redirect the Energy",
  "2-3": "Reinforce the Behaviours",
  "3-3": "Protect & Amplify",
  "1-2": "Have the Conversation",
  "2-2": "Stay the Course",
  "3-2": "Invest Deeper",
  "1-1": "Assess the Fit",
  "2-1": "Find What's Draining",
  "3-1": "Re-energise Now",
};

// Prescribed actions for Box 1
const BOX1_ACTIONS: Record<string, string> = {
  "Ready to Promote": "Career conversation. Discuss promotion or expanded scope this quarter.",
  "Stretch & Develop": "Assign stretch goals or project. Set 90-day development goal.",
  "Expand the Role": "Assign stretch goals if aligned to employee ambitions.",
  "Remove the Blockers": "Diagnose blocker. Create 30-day action plan. Review fortnightly.",
  "Keep Growing": "Acknowledge reliability. Set one small growth goal.",
  "Build the Foundations": "Set 30-day improvement plan with measurable outcomes.",
  "Maintain & Recognise": "Clarify expectations. Ask if they want more or are content.",
  "Deepen the Expertise": "Recognise expertise. Protect from burnout.",
  "Intervene Now": "Direct conversation this week. Move to PIP.",
};

// Prescribed actions for Box 2
const BOX2_ACTIONS: Record<string, string> = {
  "Protect & Amplify": "Amplify. Look for further cultural impact opportunities.",
  "Reinforce the Behaviours": "Call out specific values behaviours you want more of.",
  "Redirect the Energy": "Set 30-day focus on 1-2 specific values with examples.",
  "Invest Deeper": "Ask what would deepen their engagement.",
  "Stay the Course": "One intentional check-in question per 1:1.",
  "Have the Conversation": "Direct conversation on alignment. No shift in two months → escalate.",
  "Re-energise Now": "Identify what's draining them. Create actions.",
  "Find What's Draining": "Intervene now. Offer tangible relief ASAP.",
  "Assess the Fit": "Honest assessment on fit.",
};

// Color classes for Box 1 cells
const BOX1_COLORS: Record<string, string> = {
  "Ready to Promote": "bg-green-100 border-green-400",
  "Stretch & Develop": "bg-lime-50 border-lime-300",
  "Expand the Role": "bg-lime-50 border-lime-300",
  "Remove the Blockers": "bg-yellow-50 border-yellow-300",
  "Keep Growing": "bg-yellow-50 border-yellow-300",
  "Build the Foundations": "bg-orange-50 border-orange-300",
  "Maintain & Recognise": "bg-orange-50 border-orange-300",
  "Deepen the Expertise": "bg-yellow-50 border-yellow-300",
  "Intervene Now": "bg-red-50 border-red-300",
};

// Color classes for Box 2 cells
const BOX2_COLORS: Record<string, string> = {
  "Protect & Amplify": "bg-green-100 border-green-400",
  "Reinforce the Behaviours": "bg-lime-50 border-lime-300",
  "Invest Deeper": "bg-lime-50 border-lime-300",
  "Redirect the Energy": "bg-yellow-50 border-yellow-300",
  "Stay the Course": "bg-yellow-50 border-yellow-300",
  "Have the Conversation": "bg-orange-50 border-orange-300",
  "Find What's Draining": "bg-orange-50 border-orange-300",
  "Re-energise Now": "bg-yellow-50 border-yellow-300",
  "Assess the Fit": "bg-red-50 border-red-300",
};

export function getBox1Label(performance: number, growthReadiness: number): string {
  return BOX1_LABELS[`${performance}-${growthReadiness}`] ?? "Unknown";
}

export function getBox2Label(valuesAlignment: number, engagement: number): string {
  return BOX2_LABELS[`${valuesAlignment}-${engagement}`] ?? "Unknown";
}

export function getValuesAlignment(
  customerFirst: number,
  stepIntoArena: number,
  flockToProblems: number,
  giveEnergy: number
): number {
  const avg = (customerFirst + stepIntoArena + flockToProblems + giveEnergy) / 4;
  return Math.round(avg);
}

export function getBox1Action(label: string): string {
  return BOX1_ACTIONS[label] ?? "";
}

export function getBox2Action(label: string): string {
  return BOX2_ACTIONS[label] ?? "";
}

export function getBox1Color(label: string): string {
  return BOX1_COLORS[label] ?? "bg-gray-50 border-gray-300";
}

export function getBox2Color(label: string): string {
  return BOX2_COLORS[label] ?? "bg-gray-50 border-gray-300";
}

// Grid configuration for rendering
export interface GridCellConfig {
  x: number; // column value (performance or values)
  y: number; // row value (growth readiness or engagement)
  label: string;
  colorClass: string;
}

export const BOX1_GRID: GridCellConfig[] = [
  // Row 1 (y=3, top) — High Growth Readiness
  { x: 1, y: 3, label: "Remove the Blockers", colorClass: BOX1_COLORS["Remove the Blockers"] },
  { x: 2, y: 3, label: "Stretch & Develop", colorClass: BOX1_COLORS["Stretch & Develop"] },
  { x: 3, y: 3, label: "Ready to Promote", colorClass: BOX1_COLORS["Ready to Promote"] },
  // Row 2 (y=2, middle)
  { x: 1, y: 2, label: "Build the Foundations", colorClass: BOX1_COLORS["Build the Foundations"] },
  { x: 2, y: 2, label: "Keep Growing", colorClass: BOX1_COLORS["Keep Growing"] },
  { x: 3, y: 2, label: "Expand the Role", colorClass: BOX1_COLORS["Expand the Role"] },
  // Row 3 (y=1, bottom) — Low Growth Readiness
  { x: 1, y: 1, label: "Intervene Now", colorClass: BOX1_COLORS["Intervene Now"] },
  { x: 2, y: 1, label: "Maintain & Recognise", colorClass: BOX1_COLORS["Maintain & Recognise"] },
  { x: 3, y: 1, label: "Deepen the Expertise", colorClass: BOX1_COLORS["Deepen the Expertise"] },
];

export const BOX2_GRID: GridCellConfig[] = [
  // Row 1 (y=3, top) — High Engagement
  { x: 1, y: 3, label: "Redirect the Energy", colorClass: BOX2_COLORS["Redirect the Energy"] },
  { x: 2, y: 3, label: "Reinforce the Behaviours", colorClass: BOX2_COLORS["Reinforce the Behaviours"] },
  { x: 3, y: 3, label: "Protect & Amplify", colorClass: BOX2_COLORS["Protect & Amplify"] },
  // Row 2 (y=2, middle)
  { x: 1, y: 2, label: "Have the Conversation", colorClass: BOX2_COLORS["Have the Conversation"] },
  { x: 2, y: 2, label: "Stay the Course", colorClass: BOX2_COLORS["Stay the Course"] },
  { x: 3, y: 2, label: "Invest Deeper", colorClass: BOX2_COLORS["Invest Deeper"] },
  // Row 3 (y=1, bottom) — Low Engagement
  { x: 1, y: 1, label: "Assess the Fit", colorClass: BOX2_COLORS["Assess the Fit"] },
  { x: 2, y: 1, label: "Find What's Draining", colorClass: BOX2_COLORS["Find What's Draining"] },
  { x: 3, y: 1, label: "Re-energise Now", colorClass: BOX2_COLORS["Re-energise Now"] },
];

export const RATING_LABELS: Record<number, string> = {
  1: "Below",
  2: "Meeting",
  3: "Exceeding",
};

// Growth Readiness specific labels
export const GROWTH_READINESS_LABELS: Record<number, string> = {
  1: "Developing",
  2: "Building",
  3: "Ready Now",
};

// Talent tiers: which boxes count as top, medium and low (decision D5).
export type Tier = "top" | "medium" | "low";

export const TIER_LABELS: Record<Tier, string> = { top: "Top", medium: "Medium", low: "Low" };

export const BOX1_TIERS: Record<Tier, string[]> = {
  top: ["Ready to Promote", "Stretch & Develop", "Expand the Role"],
  medium: ["Keep Growing", "Deepen the Expertise", "Remove the Blockers"],
  low: ["Intervene Now", "Build the Foundations", "Maintain & Recognise"],
};

export const BOX2_TIERS: Record<Tier, string[]> = {
  top: ["Protect & Amplify", "Reinforce the Behaviours", "Invest Deeper"],
  medium: ["Stay the Course", "Re-energise Now", "Redirect the Energy"],
  low: ["Assess the Fit", "Have the Conversation", "Find What's Draining"],
};

export function getTier(label: string, tiers: Record<Tier, string[]>): Tier {
  if (tiers.top.includes(label)) return "top";
  if (tiers.medium.includes(label)) return "medium";
  return "low";
}

/**
 * A performance rating of Meeting or above while more key metrics were
 * missed than hit: a coaching conversation, or a goal-setting problem.
 */
export function metricDisconnect(
  performance: number | null,
  results: { achieved: boolean | null }[]
): { hit: number; missed: number; disconnect: boolean } {
  const hit = results.filter((r) => r.achieved === true).length;
  const missed = results.filter((r) => r.achieved === false).length;
  return { hit, missed, disconnect: !!performance && performance >= 2 && missed > hit };
}
