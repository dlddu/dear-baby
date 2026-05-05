-- Reverse 0008_onboarding_cases. Drops the new children tables and
-- restores the `due_date` / removes `case_kind` columns. No data
-- preservation: the up migration is run against an empty table set
-- and there are no production users at this point.
DROP TABLE child_record_purposes;
DROP TABLE children;

ALTER TABLE onboarding DROP COLUMN case_kind;
ALTER TABLE onboarding ADD COLUMN due_date TEXT;
