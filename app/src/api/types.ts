export type User = {
  id: string;
  email: string;
  name: string;
  picture_url: string;
  // Onboarding fields — null until the user completes Stage 1 of onboarding.
  // `due_date` is "YYYY-MM-DD" (nullable so "undecided" users can still finish
  // onboarding). `onboarded_at` is an ISO timestamp set by the backend.
  due_date: string | null;
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
// `source` and `audio_s3_key` are the Stage 2 voice-record additions:
// `source` is "text" | "voice"; `audio_s3_key` is null until the
// device finishes uploading the audio blob (and may stay null forever
// when the user opts out of audio upload).
export type Record = {
  id: string;
  user_id: string;
  source: 'text' | 'voice';
  content: string;
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
