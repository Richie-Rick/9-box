// The single definition of the review: five sections, each with questions
// mirrored between the self-assessment and the manager assessment. Both
// forms, the comparison views and the server-side field whitelists derive
// from this, so adding a question here is enough to add it everywhere.

export type Audience = "self" | "manager";

export interface Question {
  /** Stable id, unique across all sections. */
  id: string;
  kind: "rating" | "text";
  /** Database column per audience. A question can exist for one side only. */
  fields: Partial<Record<Audience, string>>;
  /** Question title per audience. "{name}" is replaced with the employee's name. */
  titles: Partial<Record<Audience, string>>;
  descriptions?: Partial<Record<Audience, string>>;
  placeholders?: Partial<Record<Audience, string>>;
  /** "Consider" prompts shown beneath a rating. */
  prompts?: Partial<Record<Audience, string[]>>;
  /** Rating labels. Defaults to Below / Meeting / Exceeding. */
  labels?: Record<number, string>;
  /** Ratings are required before submit. Text is optional. */
  required?: boolean;
  /** Short label used in comparison rows and validation messages. */
  label: string;
  /** Per-side override of `label` where the two sides ask different things. */
  sideLabels?: Partial<Record<Audience, string>>;
  /** Kept for history and whitelisting but no longer asked on the form. */
  formHidden?: boolean;
}

export interface Section {
  id: string;
  title: string;
  intro: string;
  questions: Question[];
}

export const GROWTH_LABELS: Record<number, string> = { 1: "Developing", 2: "Building", 3: "Ready Now" };

export const SECTIONS: Section[] = [
  {
    id: "performance",
    title: "Performance",
    intro: "Output, quality and delivery against objectives this quarter.",
    questions: [
      {
        id: "performance.rating",
        kind: "rating",
        label: "Performance",
        required: true,
        fields: { self: "performance", manager: "performance" },
        titles: {
          self: "How would you rate your performance this quarter?",
          manager: "How would you rate {name}'s performance this quarter?",
        },
        descriptions: {
          self: "Consider your output, quality of work, and whether you met your objectives.",
          manager: "Consider output, quality of work, and delivery against objectives.",
        },
        prompts: {
          self: [
            "Did you meet your deliverables and deadlines this quarter?",
            "How was the quality of your output compared to expectations?",
            "Were you self-sufficient, or did you need significant support?",
          ],
          manager: [
            "Did this person consistently meet deadlines and quality standards?",
            "How did their output compare to peers in a similar role?",
            "Were there any notable wins or misses this quarter?",
          ],
        },
      },
      {
        id: "performance.evidence",
        kind: "text",
        label: "Evidence",
        fields: { self: "performanceJustification", manager: "performanceEvidence" },
        titles: {
          self: "What evidence supports your rating?",
          manager: "What evidence supports this rating?",
        },
        placeholders: {
          self: "Describe your key contributions and the evidence behind your rating...",
          manager: "Specific examples of performance, results, misses...",
        },
      },
      {
        id: "performance.achievements",
        kind: "text",
        label: "Achievements",
        sideLabels: { manager: "Achievements observed" },
        fields: { self: "achievements", manager: "achievementsObserved" },
        titles: {
          self: "What were your key achievements this quarter?",
          manager: "Which of {name}'s achievements did you observe this quarter?",
        },
        placeholders: {
          self: "List your main accomplishments...",
          manager: "Wins you saw, and what made them possible...",
        },
      },
      {
        id: "performance.blockers",
        kind: "text",
        label: "Blockers",
        sideLabels: { manager: "Blockers to remove" },
        fields: { self: "blockers", manager: "blockersToRemove" },
        titles: {
          self: "What blockers or challenges did you face?",
          manager: "Which blockers will you help remove for {name}?",
        },
        placeholders: {
          self: "Describe any obstacles that impacted your work...",
          manager: "What you will unblock, escalate or change...",
        },
      },
      {
        id: "performance.learning",
        kind: "text",
        label: "Learning",
        fields: { self: "learning" },
        titles: { self: "What did you learn this quarter?" },
        placeholders: { self: "Skills developed, insights gained..." },
      },
    ],
  },
  {
    id: "growth",
    title: "Growth Readiness",
    intro: "Readiness to take on more scope or a more senior role.",
    questions: [
      {
        id: "growth.rating",
        kind: "rating",
        label: "Growth Readiness",
        required: true,
        labels: GROWTH_LABELS,
        fields: { self: "growthReadiness", manager: "growthReadiness" },
        titles: {
          self: "How ready are you to take on more?",
          manager: "How ready is {name} to take on more?",
        },
        descriptions: {
          self: "Developing: building the basics. Building: growing into more. Ready Now: could step up today.",
          manager: "Developing: building the basics. Building: growing into more. Ready Now: could step up today.",
        },
        prompts: {
          self: [
            "Have you taken on stretch work or learned new skills this quarter?",
            "Where do you want to grow next, and what is in the way?",
            "Do you actively seek feedback and act on it?",
          ],
          manager: [
            "Is this person actively developing new skills or taking on stretch work?",
            "Could they step into a more senior role within the next 6-12 months?",
            "Do they seek feedback and apply it?",
          ],
        },
      },
      {
        id: "growth.evidence",
        kind: "text",
        label: "Evidence",
        sideLabels: { self: "Reflection" },
        fields: { self: "growthReflection", manager: "growthReadinessEvidence" },
        titles: {
          self: "Where do you want to grow next, and what shows you are ready?",
          manager: "What evidence supports this growth readiness rating?",
        },
        placeholders: {
          self: "The role or scope you want, and the evidence you are ready...",
          manager: "Growth indicators, learning agility, stretch work taken on...",
        },
      },
    ],
  },
  {
    id: "values",
    title: "Values Alignment",
    intro: "How the Visory values showed up this quarter.",
    questions: [
      {
        id: "values.customerFirst",
        kind: "rating",
        label: "Customer First",
        required: true,
        fields: { self: "valCustomerFirst", manager: "valCustomerFirst" },
        titles: { self: "Customer First", manager: "Customer First" },
        prompts: {
          self: [
            "Did you proactively consider client outcomes in your decisions?",
            "Did you go beyond what was asked to deliver a better result for the client?",
          ],
          manager: [
            "Has this person demonstrated ownership of client outcomes?",
            "Have clients or colleagues noted their client-first approach?",
          ],
        },
      },
      {
        id: "values.stepIntoArena",
        kind: "rating",
        label: "Step Into the Arena",
        required: true,
        fields: { self: "valStepIntoArena", manager: "valStepIntoArena" },
        titles: { self: "Step Into the Arena", manager: "Step Into the Arena" },
        prompts: {
          self: [
            "Did you volunteer for difficult tasks or conversations this quarter?",
            "Did you speak up when you disagreed or saw a problem?",
          ],
          manager: [
            "Has this person taken initiative on challenging work without being asked?",
            "Do they lean into difficult conversations rather than avoiding them?",
          ],
        },
      },
      {
        id: "values.flockToProblems",
        kind: "rating",
        label: "Flock to Problems",
        required: true,
        fields: { self: "valFlockToProblems", manager: "valFlockToProblems" },
        titles: { self: "Flock to Problems", manager: "Flock to Problems" },
        prompts: {
          self: [
            "Did you actively seek out and address problems before they escalated?",
            "Did you help a colleague or team solve a challenge this quarter?",
          ],
          manager: [
            "Does this person gravitate toward problems rather than away from them?",
            "Have they proactively identified and resolved issues?",
          ],
        },
      },
      {
        id: "values.giveEnergy",
        kind: "rating",
        label: "Give Energy",
        required: true,
        fields: { self: "valGiveEnergy", manager: "valGiveEnergy" },
        titles: { self: "Give Energy", manager: "Give Energy" },
        prompts: {
          self: [
            "Did you contribute positively to team morale and energy this quarter?",
            "Did you support or uplift a colleague who was struggling?",
          ],
          manager: [
            "Does this person lift the energy of those around them?",
            "Do teammates seek them out for collaboration and support?",
          ],
        },
      },
      {
        id: "values.reflection",
        kind: "text",
        label: "Values reflection",
        sideLabels: { manager: "Values evidence" },
        fields: { self: "valuesReflection", manager: "valuesEvidence" },
        titles: {
          self: "Share examples of how you demonstrated the Visory values",
          manager: "Give examples of values-aligned behaviour you observed",
        },
        placeholders: {
          self: "Give specific examples of how you demonstrated Visory values...",
          manager: "Examples of values-aligned behaviour...",
        },
      },
    ],
  },
  {
    id: "engagement",
    title: "Engagement",
    intro: "Motivation, energy and connection to the team.",
    questions: [
      {
        id: "engagement.rating",
        kind: "rating",
        label: "Engagement",
        required: true,
        fields: { self: "engagement", manager: "engagement" },
        titles: {
          self: "How engaged do you feel at work?",
          manager: "How engaged does {name} appear?",
        },
        descriptions: {
          self: "Consider your motivation, energy, and connection to the team.",
          manager: "Consider enthusiasm, discretionary effort and participation.",
        },
        prompts: {
          self: [
            "How motivated do you feel about your day-to-day work?",
            "Do you feel connected to the team's goals and mission?",
          ],
          manager: [
            "Does this person show enthusiasm and discretionary effort?",
            "Are there signs of disengagement — withdrawal, minimal participation?",
          ],
        },
      },
      {
        id: "engagement.driver",
        kind: "text",
        label: "What's driving it",
        sideLabels: { manager: "Evidence" },
        fields: { self: "engagementDriver", manager: "engagementEvidence" },
        titles: {
          self: "What's driving your engagement level?",
          manager: "What do you observe driving {name}'s engagement?",
        },
        placeholders: {
          self: "What energises or drains you at work...",
          manager: "Observable behaviours that support this rating...",
        },
      },
      {
        id: "engagement.support",
        kind: "text",
        label: "Support needed",
        sideLabels: { manager: "Support committed" },
        fields: { self: "supportNeeded", manager: "supportCommitted" },
        titles: {
          self: "What support do you need from your manager?",
          manager: "What support will you provide {name} next quarter?",
        },
        placeholders: {
          self: "Resources, guidance, feedback...",
          manager: "Time, coaching, resources, introductions...",
        },
      },
    ],
  },
  {
    id: "ahead",
    title: "Looking Ahead",
    intro: "Goals for next quarter and anything else worth recording.",
    questions: [
      {
        // Free-text goals were replaced by tracked goals (SelfGoalsEditor);
        // the column stays whitelisted so older cycles still display.
        id: "ahead.goals",
        kind: "text",
        label: "Goals for next quarter",
        formHidden: true,
        fields: { self: "goalsNextMonth" },
        titles: { self: "What are your goals for next quarter?" },
      },
      {
        id: "ahead.notes",
        kind: "text",
        label: "Priorities and notes",
        fields: { manager: "notes" },
        titles: { manager: "Priorities and notes for {name}'s next quarter" },
        placeholders: { manager: "Focus areas, agreed actions, anything else worth recording..." },
      },
    ],
  },
];

/** Replace the {name} placeholder in a title. */
export function withName(text: string | undefined, name: string): string {
  return (text ?? "").replace(/\{name\}/g, name || "this person");
}

/** The label a side uses for a question in comparisons. */
export function sideLabel(question: Question, audience: Audience): string {
  return question.sideLabels?.[audience] ?? question.label;
}

/** Questions that exist for the given audience, in section order. */
export function questionsFor(audience: Audience): { section: Section; question: Question }[] {
  const out: { section: Section; question: Question }[] = [];
  for (const section of SECTIONS) {
    for (const question of section.questions) {
      if (question.fields[audience]) out.push({ section, question });
    }
  }
  return out;
}

/** Column names by kind for the given audience. */
export function fieldsFor(audience: Audience): { rating: string[]; text: string[]; required: string[]; labels: Record<string, string> } {
  const rating: string[] = [];
  const text: string[] = [];
  const required: string[] = [];
  const labels: Record<string, string> = {};
  for (const { question } of questionsFor(audience)) {
    const field = question.fields[audience]!;
    if (question.kind === "rating") rating.push(field);
    else text.push(field);
    if (question.required) required.push(field);
    labels[field] = question.label;
  }
  return { rating, text, required, labels };
}
