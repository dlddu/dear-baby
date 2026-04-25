// LocalAudio represents one record whose **transcript already lives on
// the server** but whose original audio is still local-only. The server
// `records` row was created at save time (so `record_id` is the
// authoritative key); the audio file is the artifact the boundary
// between "saved" and "uploaded" gets drawn around.
//
// Status semantics:
//  - `local`      audio sitting on this device, no upload in flight.
//  - `uploading`  upload orchestrator currently has a presigned URL
//                 and/or PUT in flight. Used to prevent double-uploads
//                 if the user taps the button twice.
//  - `failed`     the most recent upload attempt failed; `last_error`
//                 carries the reason for the UI to surface.
export type LocalAudioStatus = 'local' | 'uploading' | 'failed';

export type LocalAudio = {
  /** Server record id — also the key in the local store. */
  record_id: string;
  /** ISO 8601 timestamp captured client-side at save time. */
  created_at: string;
  /** Absolute file:// URI to the m4a in this device's documentDirectory. */
  audio_path: string;
  /** Best-effort recording length in milliseconds (recorder-reported). */
  audio_duration_ms: number;
  /** Short transcript snippet for the list row — never the full text. */
  transcript_preview: string;
  upload_status: LocalAudioStatus;
  /** Human-readable failure reason from the most recent upload. */
  last_error?: string;
};
