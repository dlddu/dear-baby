// User mirrors the backend `users` row joined with `onboarding`. Onboarding
// completion is tracked by `onboarded_at` alone — the case-branching
// onboarding (PRD-006 AC-006-01~04) submits a richer payload via POST
// /onboarding/case which records `case_kind` plus the user's children.
export type User = {
  id: string;
  email: string;
  name: string;
  picture_url: string;
  // Case branch the user completed onboarding under: 'A' (임신 중), 'B'
  // (임신 + 양육), 'C' (양육 중). Null until POST /onboarding/case lands.
  case_kind: 'A' | 'B' | 'C' | null;
  // ISO timestamp set by the backend the moment the case-branching
  // onboarding submission succeeds. AuthContext switches the user from
  // 'onboarding' → 'authenticated' the first time this flips non-null.
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
// `source` is "text" | "voice"; `audio_s3_key` is null until the device
// finishes uploading the audio blob (and may stay null forever when the
// user opts out of audio upload). `question_text` is the daily question
// the home screen surfaced when the entry was started; null when the
// entry came from a path that doesn't carry a question.
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
