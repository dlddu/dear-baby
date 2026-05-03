-- Reverse 0008_onboarding_cases. Drops children/child_purposes and the
-- three case flags from onboarding.
DROP INDEX IF EXISTS idx_child_purposes_child;
DROP TABLE IF EXISTS child_purposes;
DROP INDEX IF EXISTS idx_children_user_order;
DROP TABLE IF EXISTS children;

ALTER TABLE onboarding DROP COLUMN multiple_pregnancy;
ALTER TABLE onboarding DROP COLUMN has_children;
ALTER TABLE onboarding DROP COLUMN is_pregnant;
