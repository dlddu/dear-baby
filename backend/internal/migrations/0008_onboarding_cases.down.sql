-- 케이스 분기 온보딩 롤백. due_date 컬럼은 단순 ADD COLUMN 으로 복원만 하고
-- 데이터를 되돌리지는 않는다 — 이 마이그레이션이 도입된 시점엔 운영 사용자가
-- 없으므로 보존할 값이 없다 (계획 문서 [O3] 결정).
DROP TABLE child_record_purposes;
DROP INDEX IF EXISTS idx_children_user;
DROP TABLE children;
ALTER TABLE onboarding ADD COLUMN due_date TEXT;
ALTER TABLE onboarding DROP COLUMN case_kind;
