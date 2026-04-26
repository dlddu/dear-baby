-- Extend `records` so a single row can represent both text-only entries and
-- voice entries whose audio source is uploaded to S3. The two columns are
-- intentionally orthogonal:
--
--   source        — how the user produced the entry ('text' | 'voice').
--                   This drives UX (badge, list ordering hooks) but does NOT
--                   imply anything about audio presence.
--   audio_s3_key  — nullable, and may stay null forever. The user can always
--                   choose to keep the audio file local-only or delete it
--                   from their device entirely; the transcript is the
--                   authoritative record and lives in `content`.
--
-- Existing rows default to 'text' so the AC-001-04 text path keeps working
-- without backfill.
ALTER TABLE records ADD COLUMN source TEXT NOT NULL DEFAULT 'text'
  CHECK(source IN ('text','voice'));
ALTER TABLE records ADD COLUMN audio_s3_key TEXT;
