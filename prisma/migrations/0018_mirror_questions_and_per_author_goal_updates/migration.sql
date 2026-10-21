-- Mirror the review questions between the self and manager assessments, and
-- let the employee and manager each record their own goal progress.
--
-- All column additions are idempotent (IF NOT EXISTS) in keeping with the
-- repair migrations 0016/0017, and nothing here touches existing data: the
-- new columns are nullable, and every existing GoalUpdate row already
-- satisfies the wider unique key.

-- Employee's own growth readiness rating and reflection.
ALTER TABLE "SelfAssessment" ADD COLUMN IF NOT EXISTS "growthReadiness" INTEGER;
ALTER TABLE "SelfAssessment" ADD COLUMN IF NOT EXISTS "growthReflection" TEXT;

-- Manager-side counterparts to achievements, blockers and support needed.
ALTER TABLE "ManagerAssessment" ADD COLUMN IF NOT EXISTS "achievementsObserved" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN IF NOT EXISTS "blockersToRemove" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN IF NOT EXISTS "supportCommitted" TEXT;

-- One goal update per author per cycle (was one per goal per cycle).
DROP INDEX IF EXISTS "GoalUpdate_goalId_cycleId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GoalUpdate_goalId_cycleId_createdById_key"
  ON "GoalUpdate"("goalId", "cycleId", "createdById");
