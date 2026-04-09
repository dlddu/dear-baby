export type User = {
  id: string;
  email: string;
  name: string;
  picture_url: string;
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
