-- Drop the Stage 2 columns made dead by the AI Preview + Voice Coachmark
-- removal. Both columns were previously populated by code paths that no
-- longer exist (see PR for context).
ALTER TABLE onboarding DROP COLUMN ai_preview;
ALTER TABLE onboarding DROP COLUMN voice_coachmark_dismissed_at;
