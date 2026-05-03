// Child mirrors backend users.ChildView 1:1 — the per-child slice the
// /me response surfaces inside `User.children`. Status discriminates
// pregnancies from already-born children; the rest is the union of
// fields the wireframe collects across both cases.
export type Child = {
  id: string;
  status: 'parenting' | 'pregnancy';
  name: string | null;
  gender: 'female' | 'male' | 'unknown';
  birth_date: string | null;
  due_date: string | null;
  pregnancy_week: number | null;
  bio: string | null;
  photo_s3_key: string | null;
  is_due_date_undecided: boolean;
  display_order: number;
  purposes: string[];
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  picture_url: string;
  // PRD-006 — due_date is deprecated and always null. Per-child due
  // dates live on `children[i].due_date`. Kept on the type for backward
  // compatibility with code paths that haven't migrated yet (notably
  // the home screen pregnancy-week badge — see the known-regression
  // note in the PR description).
  due_date: string | null;
  // `onboarded_at` is an ISO timestamp set by the backend when the
  // user finishes the case-branching funnel (POST /onboarding/complete).
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
  // PRD-006 case-branching answers. All three are null until the user
  // answers the relevant onboarding step.
  is_pregnant: boolean | null;
  has_children: boolean | null;
  multiple_pregnancy: boolean | null;
  // Children — empty array until POST /onboarding/children succeeds.
  // Order mirrors the user's input order via `display_order`.
  children: Child[];
  created_at: string;
  updated_at: string;
};

// Record mirrors the backend `records` row returned by POST /records.
// `source` and `audio_s3_key` are the Stage 2 voice-record additions:
// `source` is "text" | "voice"; `audio_s3_key` is null until the
// device finishes uploading the audio blob (and may stay null forever
// when the user opts out of audio upload). `question_text` is the
// daily question the home screen surfaced when the entry was started;
// null when the entry came from a path that doesn't carry a question.
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
