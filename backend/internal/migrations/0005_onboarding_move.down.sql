-- Reverse 0005_onboarding_move by re-adding the onboarding columns on
-- users and copying values back. `ai_preview` is lost on rollback — there
-- is no home for it on the users table.
ALTER TABLE users ADD COLUMN due_date TEXT;
ALTER TABLE users ADD COLUMN onboarded_at TEXT;
ALTER TABLE users ADD COLUMN stage2_coachmark_dismissed_at TEXT;
ALTER TABLE users ADD COLUMN first_record_at TEXT;

UPDATE users SET
  due_date = (SELECT due_date FROM onboarding WHERE onboarding.user_id = users.id),
  onboarded_at = (SELECT onboarded_at FROM onboarding WHERE onboarding.user_id = users.id),
  stage2_coachmark_dismissed_at = (SELECT voice_coachmark_dismissed_at FROM onboarding WHERE onboarding.user_id = users.id),
  first_record_at = (SELECT first_record_at FROM onboarding WHERE onboarding.user_id = users.id);

DROP TABLE onboarding;
