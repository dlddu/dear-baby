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
  // Voice-record coachmark dismissal timestamp. Null until the user closes
  // the coachmark on the home screen; once stamped, the coachmark never
  // shows again.
  voice_coachmark_dismissed_at: string | null;
  // Timestamp of the user's first saved record. Drives the home-screen AI
  // preview unblur: null → teaser, set → loading/ready state.
  first_record_at: string | null;
  // AI-edited version of the user's first record. Populated asynchronously
  // by the worker after the first record is saved. Null while pending.
  ai_preview: string | null;
  created_at: string;
  updated_at: string;
};

// Record mirrors the backend `records` row returned by POST /records.
// Today only text records exist; voice is a separate PRD.
export type Record = {
  id: string;
  user_id: string;
  content: string;
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
