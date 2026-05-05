// CaseKind mirrors backend onboarding.Case — the result of the two
// independent checks at the top of onboarding (PRD-006 AC-006-01). Null
// until the user submits POST /onboarding/case.
export type CaseKind = 'A' | 'B' | 'C';

export type User = {
  id: string;
  email: string;
  name: string;
  picture_url: string;
  // Onboarding fields — null until the user completes case-branched
  // onboarding (PRD-006). `onboarded_at` is the backend's completion
  // marker stamped by POST /onboarding/case; `case_kind` records which
  // branch the user took.
  case_kind: CaseKind | null;
  onboarded_at: string | null;
  // Voice-record coachmark dismissal timestamp (shown on the home screen).
  // Null until the user closes the coachmark; once stamped, the coachmark
  // never shows again.
  voice_coachmark_dismissed_at: string | null;
  // Timestamp of the user's first saved record. Drives the AI preview
  // state: null → blurred teaser; set → request + render the LLM-edited
  // preview. Stamped once by the backend and preserved on subsequent
  // records.
  first_record_at: string | null;
  // AI-edited preview text. Null until the worker finishes editing the
  // first record. The home screen subscribes to an SSE stream that
  // notifies when this flips from null → string.
  ai_preview: string | null;
  created_at: string;
  updated_at: string;
};

// Record mirrors the backend `records` row returned by POST /records.
// `source` and `audio_s3_key` are the voice-record additions: `source`
// is "text" | "voice"; `audio_s3_key` is null until the device finishes
// uploading the audio blob (and may stay null forever when the user
// opts out of audio upload). `question_text` is the daily question the
// home screen surfaced when the entry was started; null when the entry
// came from a path that doesn't carry a question.
export type Record = {
  id: string;
  user_id: string;
  source: 'text' | 'voice';
  content: string;
  question_text: string | null;
  audio_s3_key: string | null;
  created_at: string;
};

// CreateRecordResponse is the POST /records body: the new record plus the
// updated user, so AuthContext can refresh in one round-trip.
export type CreateRecordResponse = {
  record: Record;
  user: User;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export type SessionResponse = {
  access_token: string;
  refresh_token: string;
  user: User;
};
