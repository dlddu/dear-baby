-- Remove the virtual fetus rows that 0009 backfilled. Targets rows that
-- match the synthesized shape (ordinal=1, no nickname/gender/week, all
-- onboarding fields besides due_date untouched on the user).
DELETE FROM fetuses
  WHERE ordinal = 1
    AND nickname IS NULL
    AND gender IS NULL
    AND pregnancy_week IS NULL
    AND user_id IN (
      SELECT o.user_id FROM onboarding o WHERE o.due_date IS NOT NULL
    );
