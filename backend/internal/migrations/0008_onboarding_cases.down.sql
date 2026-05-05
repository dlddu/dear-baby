-- Reverse 0008_onboarding_cases. Restores the schema shape only — no data
-- is migrated back into `onboarding.due_date` because [O3] guarantees there
-- are no production users at the time of this migration.
DROP TABLE IF EXISTS child_record_purposes;
DROP INDEX IF EXISTS idx_children_user;
DROP TABLE IF EXISTS children;

ALTER TABLE onboarding DROP COLUMN case_kind;
ALTER TABLE onboarding ADD COLUMN due_date TEXT;
