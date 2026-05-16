-- Backfill: 0008 추가 전, "임신만 있는" 사용자는 fetuses 행 없이
-- onboarding.due_date 만 채워져 있었다. 이후 앱은 ActiveChildContext 에서
-- fetuses·children 이 모두 비고 due_date 만 있는 경우 화면 표시용 가상 fetus
-- 행 1개를 합성해 호환을 유지했다. 본 백필은 그 가상 행을 실제 fetuses 행으로
-- 영속화해, 앱이 더 이상 호환 분기를 들고 다니지 않아도 되도록 한다.
--
-- 멱등성: 이미 fetuses 나 children 행이 한 줄이라도 있는 사용자는 건너뛴다.
-- Case A/B/C 완료자나 추후 본 마이그레이션을 두 번 돌리는 상황 모두에서 안전.
INSERT INTO fetuses (user_id, ordinal, due_date)
  SELECT o.user_id, 0, o.due_date
  FROM onboarding o
  WHERE o.due_date IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM fetuses  f WHERE f.user_id = o.user_id)
    AND NOT EXISTS (SELECT 1 FROM children c WHERE c.user_id = o.user_id);
