-- Rollback: 0009 백필이 만든 가상 행만 제거. 가상 행은 nickname·gender·
-- pregnancy_week 가 모두 NULL 이고 ordinal=0 이며, 같은 사용자에 다른
-- fetus 행이 없는 경우만 백필 결과로 간주한다. Case A/B/C 로 정상 저장된 행은
-- 다른 필드가 채워져 있거나 ordinal 이 양의 정수라 영향을 받지 않는다.
DELETE FROM fetuses
WHERE ordinal = 0
  AND nickname IS NULL
  AND gender IS NULL
  AND pregnancy_week IS NULL
  AND purposes_json = '[]'
  AND (SELECT COUNT(*) FROM fetuses f2 WHERE f2.user_id = fetuses.user_id) = 1;
