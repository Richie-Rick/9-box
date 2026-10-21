-- Repair drifted nullability on the User table.
--
-- Production's database was originally created with `prisma db push` from an
-- older schema (see migration 0016), so some columns drifted from the Prisma
-- schema. `User.jobTitle` and `User.team` are optional (nullable) in the schema
-- but landed on production as NOT NULL (with a default), which made invited-user
-- registration fail with a P2011 null-constraint violation whenever an
-- invitation carried no jobTitle/team — the common case.
--
-- Bring the columns back in line with the schema: drop the stray NOT NULL
-- constraint and any default so an explicit NULL is accepted. All statements are
-- idempotent / no-ops when the column is already nullable and default-free, so
-- this is safe whether or not the drift is present, and it never touches data.

ALTER TABLE "User" ALTER COLUMN "jobTitle" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "jobTitle" DROP DEFAULT;

ALTER TABLE "User" ALTER COLUMN "team" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "team" DROP DEFAULT;
