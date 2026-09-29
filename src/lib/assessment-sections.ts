// The single definition of the review: five sections, each with questions
// that are mirrored between the self-assessment and the manager assessment.
// Both forms, the comparison views and the meeting view render from this,
// and the server derives its field whitelist from it.

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
  prompts?: Partial<Record<Audience, string[]>>;
  /** Rating labels. Defaults to Below / Meeting / Exceeding. */
  labels?: Record<number, string>;
  /** Ratings are required before submit. Text is optional. */
  required?: boolean;
  /** Short label used in comparison rows and validation messages. */
  label: string;
  /** The manager's reply to the employee's comments in this section. */
  isResponse?: boolean;
}

export interface Section {
  id: string;
  title: string;
  intro: string;
  questions: Question[];
}

const GROWTH_LABELS: Record<number, string> = { 1: "Developing", 2: "Building", 3: "Ready Now" };

export const SECTIONS: Section[] = [
  {
    id: "performance",
    title: "Performance",
    intro: "Output, quality and delivery against objectives this month.",
    questions: [
      {
        id: "performance.rating",
        kind: "rating",
        label: "Performance",
        required: true,
        fields: { self: "performance", manager: "performance" },
        titles: {
          self: "How would you rate your performance this month?",
          manager: "How would you rate {name}'s performance this month?",
        },
        descriptions: {
          self: "Consider your output, quality of work, and whether you met your objectives.",
          manager: "Consider output, quality of work, and delivery against objectives.",
        },
        prompts: {
          self: [
            "Did you meet your deliverables and deadlines this month?",
            "How was the quality of your output compared to expectations?",
            "Were you self-sufficient, or did you need significant support?",
          ],
          manager: [
            "Did this person consistently meet deadlines and quality standards?",
            "How did their output compare to peers in a similar role?",
            "Were there any notable wins or misses this month?",
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
          self: "Describe your key contributions and results...",
          manager: "Specific examples of performance, results, misses...",
        },
      },
      {
        id: "performance.achievements",
        kind: "text",
        label: "Achievements",
        fields: { self: "achievements", manager: "achievementsObserved" },
        titles: {
          self: "What were your key achievements this month?",
          manager: "Which of {name}'s achievements did you observe this month?",
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
        fields: { self: "blockers", manager: "blockersToRemove" },
        titles: {
          self: "What blockers or challenges did you face?",
          manager: "Which blockers will you help remove for {name}?",
        },
        placeholders: {
          self: "Obstacles that affected your work...",
          manager: "What you will unblock, escalate or change...",
        },
      },
      {
        id: "performance.learning",
        kind: "text",
        label: "Learning",
        fields: { self: "learning" },
        titles: { self: "What did you learn this month?" },
        placeholders: { self: "Skills developed, insights gained..." },
      },
      {
        id: "performance.response",
        kind: "text",
        label: "Manager's response",
        isResponse: true,
        fields: { manager: "responsePerformance" },
        titles: { manager: "Your response to {name}'s comments on performance" },
        placeholders: { manager: "Acknowledge, add context, or explain where you see it differently..." },
      },
    ],
  },
  {
    id: "growth",
    title: "Growth",
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
            "Have you taken on stretch work or learned new skills this month?",
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
      {
        id: "growth.response",
        kind: "text",
        label: "Manager's response",
        isResponse: true,
        fields: { manager: "responseGrowth" },
        titles: { manager: "Your response to {name}'s comments on growth" },
        placeholders: { manager: "What you agree with, what you would add, and the next step..." },
      },
    ],
  },
  {
    id: "values",
    title: "Values",
    intro: "How the Visory values showed up this month.",
    questions: [
      {
        id: "values.customerFirst",
        kind: "rating",
        label: "Customer First",
        required: true,
        fields: { self: "valCustomerFirst", manager: "valCustomerFirst" },
        titles: { self: "Customer First", manager: "Customer First" },
        descriptions: {
          self: "How well did you embody 'Customer First'?",
          manager: "How well does {name} embody 'Customer First'?",
        },
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
        descriptions: {
          self: "How well did you step up and take initiative?",
          manager: "How well does {name} take initiative and show courage?",
        },
        prompts: {
          self: [
            "Did you volunteer for difficult tasks or conversations this month?",
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
        descriptions: {
          self: "How well did you seek out and address challenges?",
          manager: "How well does {name} seek out and address challenges?",
        },
        prompts: {
          self: [
            "Did you actively seek out and address problems before they escalated?",
            "Did you help a colleague or team solve a challenge this month?",
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
        descriptions: {
          self: "How well did you energise and support those around you?",
          manager: "How well does {name} energise and uplift the team?",
        },
        prompts: {
          self: [
            "Did you contribute positively to team morale and energy this month?",
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
        fields: { self: "valuesReflection", manager: "valuesEvidence" },
        titles: {
          self: "Share examples of how you demonstrated the Visory values",
          manager: "Give examples of values-aligned behaviour you observed",
        },
        placeholders: {
          self: "Specific examples...",
          manager: "Specific examples...",
        },
      },
      {
        id: "values.response",
        kind: "text",
        label: "Manager's response",
        isResponse: true,
        fields: { manager: "responseValues" },
        titles: { manager: "Your response to {name}'s comments on values" },
        placeholders: { manager: "Behaviours you want to see more of, and any gap you see..." },
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
            "Are there signs of disengagement, such as withdrawal or minimal participation?",
          ],
        },
      },
      {
        id: "engagement.driver",
        kind: "text",
        label: "What's driving it",
        fields: { self: "engagementDriver", manager: "engagementEvidence" },
        titles: {
          self: "What's driving your engagement level?",
          manager: "What do you observe driving {name}'s engagement?",
        },
        placeholders: {
          self: "What energises or drains you at work...",
          manager: "Observable behaviours, changes you have noticed...",
        },
      },
      {
        id: "engagement.support",
        kind: "text",
        label: "Support",
        fields: { self: "supportNeeded", manager: "supportCommitted" },
        titles: {
          self: "What support do you need from your manager?",
          manager: "What support will you provide {name} next month?",
        },
        placeholders: {
          self: "Resources, guidance, feedback...",
          manager: "Time, coaching, resources, introductions...",
        },
      },
      {
        id: "engagement.response",
        kind: "text",
        label: "Manager's response",
        isResponse: true,
        fields: { manager: "responseEngagement" },
        titles: { manager: "Your response to {name}'s comments on engagement" },
        placeholders: { manager: "What you heard, and what you will do about it..." },
      },
    ],
  },
  {
    id: "ahead",
    title: "Looking ahead",
    intro: "Goals for next month and anything else worth recording.",
    questions: [
      {
        id: "ahead.goals",
        kind: "text",
        label: "Goals for next month",
        fields: { self: "goalsNextMonth" },
        titles: { self: "What are your goals for next month?" },
        placeholders: { self: "Key priorities and objectives. You can also propose these as tracked goals above." },
      },
      {
        id: "ahead.notes",
        kind: "text",
        label: "Priorities and notes",
        fields: { manager: "notes" },
        titles: { manager: "Priorities and notes for {name}'s next month" },
        placeholders: { manager: "Focus areas, agreed actions, anything else worth recording..." },
      },
    ],
  },
];

/** Replace the {name} placeholder in a title. */
export function withName(text: string | undefined, name: string): string {
  return (text ?? "").replace(/\{name\}/g, name || "this person");
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
export function fieldsFor(audience: Audience): { rating: string[]; text: string[]; required: string[]; response: string[] } {
  const rating: string[] = [];
  const text: string[] = [];
  const required: string[] = [];
  const response: string[] = [];
  for (const { question } of questionsFor(audience)) {
    const field = question.fields[audience]!;
    if (question.kind === "rating") rating.push(field);
    else text.push(field);
    if (question.required) required.push(field);
    if (question.isResponse) response.push(field);
  }
  return { rating, text, required, response };
}

/** Rating fields of a section for the given audience. */
export function sectionRatingFields(sectionId: string, audience: Audience): string[] {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section) return [];
  return section.questions
    .filter((q) => q.kind === "rating" && q.fields[audience])
    .map((q) => q.fields[audience]!);
}

/** Sections that carry a manager response question. */
export const RESPONSE_SECTION_IDS = SECTIONS.filter((s) => s.questions.some((q) => q.isResponse)).map((s) => s.id);
