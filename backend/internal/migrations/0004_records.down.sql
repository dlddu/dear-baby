ALTER TABLE users DROP COLUMN first_record_at;
DROP INDEX IF EXISTS idx_records_user_id_created_at;
DROP TABLE records;
