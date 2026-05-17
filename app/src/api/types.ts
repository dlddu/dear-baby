// FetusProfile mirrors the backend `fetuses` row exposed on /me. Stored
// shape lives in `backend/internal/users/model.go` (`FetusProfile`).
export type FetusProfile = {
  ordinal: number;
  nickname: string | null;
  gender: string | null;
  pregnancy_week: number | null;
  due_date: string | null;
  // 기록 목적(Purpose) 한국어 라벨 그대로 (PRD-006 AC-006-02).
  purposes: string[];
};

// ChildProfile mirrors the backend `children` row exposed on /me.
export type ChildProfile = {
  ordinal: number;
  name: string | null;
  gender: string | null;
  birth_date: string | null;
  bio: string | null;
  // 기록 목적(Purpose) 한국어 라벨 그대로 (PRD-006 AC-006-04).
  purposes: string[];
};

export type User = {
  id: string;
  email: string;
  name: string;
  picture_url: string;
  // Onboarding completion marker — null until the user completes Stage 1.
  // `onboarded_at` is an ISO timestamp set by the backend.
  onboarded_at: string | null;
  // Timestamp of the user's first saved record. Stamped once by the
  // backend and preserved on subsequent records.
  first_record_at: string | null;
  // Per-태아 / per-아이 onboarding rows. Empty array until Case A/C
  // completion. Each row carries the chip-selected purposes the client
  // replicated to every entry on A3/C3.
  fetuses: FetusProfile[];
  children: ChildProfile[];
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
