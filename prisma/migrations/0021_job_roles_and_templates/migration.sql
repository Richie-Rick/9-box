-- Job roles with role-level metric and goal templates. Templates are
-- materialised per person as "role-set" key metrics and goals (templateId).
--
-- Additive and idempotent like 0016–0020. Existing job titles are seeded as
-- roles and linked, so role-set templates can be attached straight away;
-- no existing rows are otherwise changed.

-- CreateTable
CREATE TABLE IF NOT EXISTS "JobRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MetricTemplate" (
    "id" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "team" TEXT,
    "name" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "unit" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GoalTemplate" (
    "id" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "team" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueOffsetDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalTemplate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobRoleId" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
ALTER TABLE "KeyMetric" ADD COLUMN IF NOT EXISTS "templateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "JobRole_name_key" ON "JobRole"("name");
CREATE INDEX IF NOT EXISTS "MetricTemplate_jobRoleId_idx" ON "MetricTemplate"("jobRoleId");
CREATE INDEX IF NOT EXISTS "GoalTemplate_jobRoleId_idx" ON "GoalTemplate"("jobRoleId");
CREATE INDEX IF NOT EXISTS "User_jobRoleId_idx" ON "User"("jobRoleId");
CREATE INDEX IF NOT EXISTS "Goal_templateId_idx" ON "Goal"("templateId");
CREATE INDEX IF NOT EXISTS "KeyMetric_templateId_idx" ON "KeyMetric"("templateId");

-- AddForeignKey (guarded: Postgres has no IF NOT EXISTS for constraints)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_jobRoleId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MetricTemplate_jobRoleId_fkey') THEN
    ALTER TABLE "MetricTemplate" ADD CONSTRAINT "MetricTemplate_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MetricTemplate_createdById_fkey') THEN
    ALTER TABLE "MetricTemplate" ADD CONSTRAINT "MetricTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GoalTemplate_jobRoleId_fkey') THEN
    ALTER TABLE "GoalTemplate" ADD CONSTRAINT "GoalTemplate_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GoalTemplate_createdById_fkey') THEN
    ALTER TABLE "GoalTemplate" ADD CONSTRAINT "GoalTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Goal_templateId_fkey') THEN
    ALTER TABLE "Goal" ADD CONSTRAINT "Goal_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "GoalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KeyMetric_templateId_fkey') THEN
    ALTER TABLE "KeyMetric" ADD CONSTRAINT "KeyMetric_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MetricTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed: one role per distinct job title (case-insensitive), then link users.
INSERT INTO "JobRole" ("id", "name")
SELECT gen_random_uuid()::text, t.title
FROM (
  SELECT DISTINCT ON (lower(trim("jobTitle"))) trim("jobTitle") AS title
  FROM "User"
  WHERE "jobTitle" IS NOT NULL AND trim("jobTitle") <> ''
  ORDER BY lower(trim("jobTitle")), trim("jobTitle")
) t
ON CONFLICT ("name") DO NOTHING;

UPDATE "User" u
SET "jobRoleId" = r.id
FROM "JobRole" r
WHERE u."jobRoleId" IS NULL
  AND u."jobTitle" IS NOT NULL
  AND lower(trim(u."jobTitle")) = lower(r.name);
