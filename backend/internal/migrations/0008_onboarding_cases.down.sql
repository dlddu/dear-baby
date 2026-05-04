-- Reverse 0008_onboarding_cases. Sufficient for the pre-launch state where
-- no real users exist (PRD-006 [O3]); a future re-rollout would migrate
-- existing children rows back into a chosen due_date by some product rule.
DROP TABLE child_record_purposes;
DROP TABLE children;

ALTER TABLE onboarding DROP COLUMN case_kind;
ALTER TABLE onboarding ADD COLUMN due_date TEXT;
