-- Drop the onboarding.due_date column. The Stage 1 onboarding flow no
-- longer copies the first fetus's due date into onboarding row — per-fetus
-- due dates live on `fetuses.due_date` (see 0008/0009) and that is the
-- single source of truth. With Case A·B·C write paths and the /me read
-- path no longer touching this column, dropping it removes the dead state.
ALTER TABLE onboarding DROP COLUMN due_date;
