-- 스냅샷은 f(작성일, 기준값) 의 캐시(파생값)라 DROP 으로 잃는 정보가 없다 —
-- 언제 다시 돌려도 같은 값이 나오는 것이 ENG-013 이 백필을 안전하다고 한
-- 근거다. 0011 이 이미 ALTER TABLE ... DROP COLUMN 을 쓰므로 이 레포의 SQLite
-- 가 해당 문법을 지원한다는 것은 검증돼 있다.
DROP INDEX IF EXISTS idx_records_stage;
ALTER TABLE records DROP COLUMN stage_months;
ALTER TABLE records DROP COLUMN stage_days;
ALTER TABLE records DROP COLUMN stage_kind;
