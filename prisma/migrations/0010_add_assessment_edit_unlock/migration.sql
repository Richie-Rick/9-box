-- AlterTable
ALTER TABLE "ManagerAssessment" ADD COLUMN "lastEditedAt" TIMESTAMP(3);
ALTER TABLE "ManagerAssessment" ADD COLUMN "unlockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SelfAssessment" ADD COLUMN "lastEditedAt" TIMESTAMP(3);
ALTER TABLE "SelfAssessment" ADD COLUMN "unlockedAt" TIMESTAMP(3);
