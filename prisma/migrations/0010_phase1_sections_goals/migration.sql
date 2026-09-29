-- Mirrored sections: new self and manager columns
ALTER TABLE "SelfAssessment" ADD COLUMN "growthReadiness" INTEGER;
ALTER TABLE "SelfAssessment" ADD COLUMN "growthReflection" TEXT;

ALTER TABLE "ManagerAssessment" ADD COLUMN "achievementsObserved" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN "blockersToRemove" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN "supportCommitted" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN "responsePerformance" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN "responseGrowth" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN "responseValues" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN "responseEngagement" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN "initialRatings" JSONB;

-- Goal proposals
ALTER TYPE "GoalStatus" ADD VALUE 'PROPOSED' BEFORE 'ACTIVE';
ALTER TABLE "Goal" ADD COLUMN "proposedById" TEXT;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Goal status updates per cycle
CREATE TYPE "GoalUpdateStatus" AS ENUM ('ON_TRACK', 'OFF_TRACK', 'DONE');

CREATE TABLE "GoalUpdate" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "GoalUpdateStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoalUpdate_goalId_cycleId_authorId_key" ON "GoalUpdate"("goalId", "cycleId", "authorId");
CREATE INDEX "GoalUpdate_cycleId_idx" ON "GoalUpdate"("cycleId");

ALTER TABLE "GoalUpdate" ADD CONSTRAINT "GoalUpdate_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalUpdate" ADD CONSTRAINT "GoalUpdate_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AssessmentCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalUpdate" ADD CONSTRAINT "GoalUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
