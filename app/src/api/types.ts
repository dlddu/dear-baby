// Case bucket the user landed on at the end of the case-branching
// onboarding funnel. Null until the user finishes; set to 'A'|'B'|'C'
// thereafter — the home screen consumes it to render case-aware
// affordances.
export type OnboardingCase = 'A' | 'B' | 'C';

export type User = {
  id: string;
  email: string;
  name: string;
  picture_url: string;
  // Case-branching onboarding fields. Null until the user submits
  // POST /onboarding/case; set thereafter. `case_kind` answers "which
  // funnel did this user complete?" and `onboarded_at` marks the moment
  // they crossed the boundary into the home screen.
  case_kind: OnboardingCase | null;
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

// Child rows are the persisted output of POST /onboarding/case. The home
// screen consumes them for the multi-child switcher and per-child
// recording context.
export type ChildKind = 'fetus' | 'child';
export type ChildGender = 'male' | 'female' | 'undecided';
export type RecordPurpose =
  | 'book_making'
  | 'memory_keeping'
  | 'family_share'
  | 'emotion_diary';

export type ChildRow = {
  id: string;
  kind: ChildKind;
  display_name: string | null;
  gender: ChildGender;
  introduction: string | null;
  photo_s3_key: string | null;
  birth_date: string | null;
  pregnancy_weeks: number | null;
  due_date: string | null;
  purposes: RecordPurpose[];
  sort_order: number;
};

// SubmitCaseResponse mirrors the backend's success payload — the
// updated profile (so AuthContext can flip to 'authenticated') plus the
// committed children rows.
export type SubmitCaseResponse = {
  user: User;
  children: ChildRow[];
};
