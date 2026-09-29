-- Cycle due dates for reminders
ALTER TABLE "AssessmentCycle" ADD COLUMN "selfDueAt" TIMESTAMP(3);
ALTER TABLE "AssessmentCycle" ADD COLUMN "managerDueAt" TIMESTAMP(3);
ALTER TABLE "AssessmentCycle" ADD COLUMN "meetingDueAt" TIMESTAMP(3);

-- One row per notification actually sent, so retries never double-send
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationLog_userId_type_refId_key" ON "NotificationLog"("userId", "type", "refId");
CREATE INDEX "NotificationLog_userId_idx" ON "NotificationLog"("userId");
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
