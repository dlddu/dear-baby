-- Rollback: ai_preview 컬럼을 되돌린다. 값은 복원되지 않으며 NULL 로 비어
-- 있다 — drop 직전의 컬럼 내용이 데이터로 어디에도 보존돼 있지 않다.
ALTER TABLE onboarding ADD COLUMN ai_preview TEXT;
