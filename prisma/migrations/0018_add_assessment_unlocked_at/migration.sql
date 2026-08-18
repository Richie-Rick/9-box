-- Unlocking a shared review for editing used to clear resultsSentAt, which
-- silently revoked the employee's access to results they had already been sent.
-- Track the unlock separately so sharing and editability are independent.
ALTER TABLE "ManagerAssessment" ADD COLUMN "unlockedAt" TIMESTAMP(3);
