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
  created_at: string;
  updated_at: string;
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
