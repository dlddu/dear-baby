-- AI Preview 기능 전체 제거에 따라 onboarding.ai_preview 컬럼을 drop 한다.
-- 앱·백엔드 코드에서 이 컬럼을 읽거나 쓰는 경로는 0009 와 같은 PR 에서 함께
-- 제거되었다.
ALTER TABLE onboarding DROP COLUMN ai_preview;
