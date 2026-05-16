-- Backfill virtual fetus rows for legacy users who completed Stage 1 via
-- the original `completeOnboarding(dueDate)` path: they stamped
-- onboarding.due_date but never created a fetuses/children row. After
-- this backfill, ActiveChildContext can drop its due_date compat branch.
--
-- Idempotent: the WHERE NOT EXISTS clauses skip users who already have
-- any fetuses or children row.
INSERT INTO fetuses (user_id, ordinal, due_date)
  SELECT o.user_id, 1, o.due_date
  FROM onboarding o
  WHERE o.due_date IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM fetuses  f WHERE f.user_id = o.user_id)
    AND NOT EXISTS (SELECT 1 FROM children c WHERE c.user_id = o.user_id);
