-- Restore the two dropped columns. Existing data is not recoverable —
-- rollback only restores the column schema, not the prior values.
ALTER TABLE onboarding ADD COLUMN ai_preview TEXT;
ALTER TABLE onboarding ADD COLUMN voice_coachmark_dismissed_at TEXT;
