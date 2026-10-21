-- Stored, admin-editable milestone dates per cycle (null falls back to the
-- computed defaults) and a log of sent notifications so nothing sends twice.
-- Additive and idempotent like 0016–0021; no existing data is touched.

ALTER TABLE "AssessmentCycle" ADD COLUMN IF NOT EXISTS "readyToMeetDueAt" TIMESTAMP(3);
ALTER TABLE "AssessmentCycle" ADD COLUMN IF NOT EXISTS "meetingDueAt" TIMESTAMP(3);
ALTER TABLE "AssessmentCycle" ADD COLUMN IF NOT EXISTS "resultsDueAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotificationLog_userId_idx" ON "NotificationLog"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationLog_userId_type_refId_key" ON "NotificationLog"("userId", "type", "refId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationLog_userId_fkey') THEN
    ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
