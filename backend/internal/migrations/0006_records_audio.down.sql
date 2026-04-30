-- SQLite < 3.35 cannot DROP columns directly, but the project pins a modern
-- modernc.org/sqlite which supports ALTER TABLE ... DROP COLUMN. We mirror
-- the up migration column-for-column so a roll-back returns records to the
-- 0004 shape.
ALTER TABLE records DROP COLUMN audio_s3_key;
ALTER TABLE records DROP COLUMN source;
