-- Restore the dropped column. Existing data is not recoverable — rollback
-- only restores the column schema, not the prior per-row values. Mirrors
-- 0010's rollback policy.
ALTER TABLE onboarding ADD COLUMN due_date TEXT;
