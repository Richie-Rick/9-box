-- Job roles, seeded from the distinct job titles already in use
CREATE TABLE "JobRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JobRole_name_key" ON "JobRole"("name");

ALTER TABLE "User" ADD COLUMN "jobRoleId" TEXT;
CREATE INDEX "User_jobRoleId_idx" ON "User"("jobRoleId");
ALTER TABLE "User" ADD CONSTRAINT "User_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "JobRole" ("id", "name")
SELECT 'role_' || md5(trim("jobTitle")), trim("jobTitle")
FROM "User"
WHERE "jobTitle" IS NOT NULL AND trim("jobTitle") <> ''
GROUP BY trim("jobTitle");

UPDATE "User" u SET "jobRoleId" = r."id"
FROM "JobRole" r
WHERE u."jobTitle" IS NOT NULL AND trim(u."jobTitle") = r."name";

-- Templates scoped to a job role
CREATE TABLE "MetricTemplate" (
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
CREATE INDEX "MetricTemplate_jobRoleId_idx" ON "MetricTemplate"("jobRoleId");
ALTER TABLE "MetricTemplate" ADD CONSTRAINT "MetricTemplate_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricTemplate" ADD CONSTRAINT "MetricTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GoalTemplate" (
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
CREATE INDEX "GoalTemplate_jobRoleId_idx" ON "GoalTemplate"("jobRoleId");
ALTER TABLE "GoalTemplate" ADD CONSTRAINT "GoalTemplate_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalTemplate" ADD CONSTRAINT "GoalTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Goal" ADD COLUMN "templateId" TEXT;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "GoalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Results recorded against a metric (personal or role-set) per cycle
CREATE TABLE "KeyMetricResult" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "keyMetricId" TEXT,
    "metricTemplateId" TEXT,
    "actual" TEXT NOT NULL,
    "achieved" BOOLEAN,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyMetricResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KeyMetricResult_employeeId_cycleId_keyMetricId_key" ON "KeyMetricResult"("employeeId", "cycleId", "keyMetricId");
CREATE UNIQUE INDEX "KeyMetricResult_employeeId_cycleId_metricTemplateId_key" ON "KeyMetricResult"("employeeId", "cycleId", "metricTemplateId");
CREATE INDEX "KeyMetricResult_cycleId_idx" ON "KeyMetricResult"("cycleId");
ALTER TABLE "KeyMetricResult" ADD CONSTRAINT "KeyMetricResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KeyMetricResult" ADD CONSTRAINT "KeyMetricResult_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AssessmentCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KeyMetricResult" ADD CONSTRAINT "KeyMetricResult_keyMetricId_fkey" FOREIGN KEY ("keyMetricId") REFERENCES "KeyMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KeyMetricResult" ADD CONSTRAINT "KeyMetricResult_metricTemplateId_fkey" FOREIGN KEY ("metricTemplateId") REFERENCES "MetricTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KeyMetricResult" ADD CONSTRAINT "KeyMetricResult_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
