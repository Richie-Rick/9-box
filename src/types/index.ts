export type { Role } from "@prisma/client";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  managerId: string | null;
  isActive: boolean;
  manager?: { id: string; name: string } | null;
}

export interface CycleData {
  id: string;
  month: number;
  year: number;
  status: "OPEN" | "CLOSED";
  selfDueAt?: string | null;
  managerDueAt?: string | null;
  meetingDueAt?: string | null;
  createdAt: string;
}

export interface ManagerAssessmentData {
  id: string;
  cycleId: string;
  managerId: string;
  employeeId: string;
  performance: number | null;
  performanceEvidence: string | null;
  growthReadiness: number | null;
  growthReadinessEvidence: string | null;
  valCustomerFirst: number | null;
  valStepIntoArena: number | null;
  valFlockToProblems: number | null;
  valGiveEnergy: number | null;
  valuesEvidence: string | null;
  engagement: number | null;
  engagementEvidence: string | null;
  notes: string | null;
  initialRatings?: Record<string, number> | null;
  submittedAt: string | null;
  sharedAt?: string | null;
  oneOnOneCompletedAt?: string | null;
  editCount?: number;
  lastEditedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; name: string; email: string; role: string; team: string | null; jobTitle: string | null };
  manager?: { id: string; name: string };
}

export interface SelfAssessmentData {
  id: string;
  cycleId: string;
  employeeId: string;
  performance: number | null;
  performanceJustification: string | null;
  achievements: string | null;
  blockers: string | null;
  learning: string | null;
  valCustomerFirst: number | null;
  valStepIntoArena: number | null;
  valFlockToProblems: number | null;
  valGiveEnergy: number | null;
  valuesReflection: string | null;
  engagement: number | null;
  engagementDriver: string | null;
  supportNeeded: string | null;
  goalsNextMonth: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberStatus {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  team: string | null;
  managerAssessmentId: string | null;
  selfAssessmentStatus: "not_started" | "draft" | "submitted";
  managerAssessmentStatus: "not_started" | "draft" | "submitted";
  sharedAt: string | null;
  oneOnOneCompletedAt: string | null;
  stage: "not_started" | "in_progress" | "submitted" | "shared" | "meeting_done";
}
