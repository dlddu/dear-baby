// LocalAudio represents a record whose transcript is already on the
// server but whose audio source is still local-only. It is NOT a
// "draft record" in the sense of unsaved text — the records.row exists
// on the backend, with audio_s3_key = null. Users see this list as
// "음성 원본 보관함" (audio archive) and decide per-row to upload or
// delete.

export type UploadStatus = 'local' | 'uploading' | 'failed';

export type LocalAudio = {
  // record_id is the server's records.row id. It doubles as the local
  // key — there is no separate draft_id.
  record_id: string;
  // ISO timestamp of when the row was created locally; usually mirrors
  // the server's records.created_at but the backend value is the
  // authoritative one in any UI ordering.
  created_at: string;
  // Absolute file:// path to the audio blob on disk. Recomputed on
  // every read from the record_id (see draftStore.readMeta) — the
  // persisted value is ignored because the iOS app container UUID
  // embedded in the path changes across reinstalls.
  audio_path: string;
  // Recording duration in milliseconds; surfaced in the list row.
  audio_duration_ms: number;
  // Short slice of the transcript shown in the list. The full
  // transcript is on the server; we keep only enough text to render
  // a list row without a network call.
  transcript_preview: string;
  upload_status: UploadStatus;
  // last_error is set when upload_status === 'failed' and lets the
  // user see what went wrong without having to retry blindly.
  last_error?: string;
};
