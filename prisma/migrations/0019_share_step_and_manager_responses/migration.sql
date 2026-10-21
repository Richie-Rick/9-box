-- Share the review ahead of the 1:1, and let the manager respond to the
-- employee's comments section by section after revealing them.
--
-- Additive and idempotent (IF NOT EXISTS), in keeping with 0016–0018. Every
-- new column is nullable; no existing data is touched.

ALTER TABLE "ManagerAssessment" ADD COLUMN IF NOT EXISTS "sharedAt" TIMESTAMP(3);
ALTER TABLE "ManagerAssessment" ADD COLUMN IF NOT EXISTS "responsePerformance" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN IF NOT EXISTS "responseGrowth" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN IF NOT EXISTS "responseValues" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN IF NOT EXISTS "responseEngagement" TEXT;
ALTER TABLE "ManagerAssessment" ADD COLUMN IF NOT EXISTS "initialRatings" JSONB;
