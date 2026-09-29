-- Share before the meeting: rename resultsSentAt and add stage fields
ALTER TABLE "ManagerAssessment" RENAME COLUMN "resultsSentAt" TO "sharedAt";
ALTER TABLE "ManagerAssessment" ADD COLUMN "finalisedAt" TIMESTAMP(3);
ALTER TABLE "ManagerAssessment" ADD COLUMN "editCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ManagerAssessment" ADD COLUMN "lastEditedAt" TIMESTAMP(3);

-- Audit log of post-submission edits
CREATE TABLE "AssessmentRevision" (
    "id" TEXT NOT NULL,
    "managerAssessmentId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,

    CONSTRAINT "AssessmentRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssessmentRevision_managerAssessmentId_idx" ON "AssessmentRevision"("managerAssessmentId");
ALTER TABLE "AssessmentRevision" ADD CONSTRAINT "AssessmentRevision_managerAssessmentId_fkey" FOREIGN KEY ("managerAssessmentId") REFERENCES "ManagerAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentRevision" ADD CONSTRAINT "AssessmentRevision_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Actions agreed in the 1:1
CREATE TABLE "AgreedAction" (
    "id" TEXT NOT NULL,
    "managerAssessmentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "goalId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreedAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgreedAction_managerAssessmentId_idx" ON "AgreedAction"("managerAssessmentId");
ALTER TABLE "AgreedAction" ADD CONSTRAINT "AgreedAction_managerAssessmentId_fkey" FOREIGN KEY ("managerAssessmentId") REFERENCES "ManagerAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgreedAction" ADD CONSTRAINT "AgreedAction_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
