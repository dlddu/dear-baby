-- 0008 의 역연산. 사용자가 없는 환경([O3])이라 데이터 복원은 필요 없고
-- 컬럼 모양만 0007 직후 상태로 되돌린다.
DROP TABLE child_record_purposes;
DROP TABLE children;

ALTER TABLE onboarding DROP COLUMN case_kind;
ALTER TABLE onboarding ADD COLUMN due_date TEXT;
