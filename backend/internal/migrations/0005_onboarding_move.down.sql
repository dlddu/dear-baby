ALTER TABLE users ADD COLUMN due_date TEXT;
ALTER TABLE users ADD COLUMN onboarded_at TEXT;
ALTER TABLE users ADD COLUMN stage2_coachmark_dismissed_at TEXT;
ALTER TABLE users ADD COLUMN first_record_at TEXT;

UPDATE users
SET due_date = (SELECT o.due_date FROM onboarding o WHERE o.user_id = users.id),
    onboarded_at = (SELECT o.onboarded_at FROM onboarding o WHERE o.user_id = users.id),
    stage2_coachmark_dismissed_at = (SELECT o.voice_coachmark_dismissed_at FROM onboarding o WHERE o.user_id = users.id),
    first_record_at = (SELECT o.first_record_at FROM onboarding o WHERE o.user_id = users.id);

DROP TABLE onboarding;
