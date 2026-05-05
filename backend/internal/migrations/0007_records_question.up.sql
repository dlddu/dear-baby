-- Records carry the daily question they answered. Stored as free
-- text so the column is forward-compatible with AC-002-02 (week-matched
-- question catalog) — when that lands, a follow-up migration can add a
-- normalized `question_id` and backfill from existing rows. Nullable so
-- pre-existing rows and any non-home entry points (deep links, future
-- flows) keep working without a backfill.
ALTER TABLE records ADD COLUMN question_text TEXT;
