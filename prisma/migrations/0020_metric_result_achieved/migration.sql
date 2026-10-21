-- Hit / missed flag on key-metric results, so performance ratings can be
-- compared against metric outcomes in Analysis. Nullable (unsure), additive
-- and idempotent like 0016–0019; no existing data is touched.

ALTER TABLE "MetricResult" ADD COLUMN IF NOT EXISTS "achieved" BOOLEAN;
