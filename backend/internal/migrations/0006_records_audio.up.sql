-- Records gain optional voice metadata. `source` distinguishes how the
-- transcript was authored (manual text vs. on-device STT). `audio_s3_key`
-- is the canonical pointer to the original audio in S3 — nullable, and
-- may stay null forever for records the user chose not to upload (the
-- transcript itself is never gated on the audio).
ALTER TABLE records ADD COLUMN source TEXT NOT NULL DEFAULT 'text'
  CHECK (source IN ('text','voice'));
ALTER TABLE records ADD COLUMN audio_s3_key TEXT;
