import { API_URL } from '../config/env';
import { apiFetch } from './client';
import type { Session, SessionResponse, User } from './types';

// exchangeGoogleIdToken posts a Google ID token to the backend and returns a
// session. The backend verifies the ID token against Google's JWKS before
// issuing the access/refresh pair.
export async function exchangeGoogleIdToken(idToken: string): Promise<Session> {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) {
    throw new Error(`google sign-in failed: ${res.status}`);
  }
  const json = (await res.json()) as SessionResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    user: json.user,
  };
}

// exchangeAppleAuthCode posts an Apple authorization code (and the optional
// given/family name returned on the first sign-in) to the backend. The
// backend exchanges the code with Apple's token endpoint and verifies the
// id_token before issuing the access/refresh pair.
export async function exchangeAppleAuthCode(input: {
  code: string;
  givenName?: string | null;
  familyName?: string | null;
}): Promise<Session> {
  const res = await fetch(`${API_URL}/auth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: input.code,
      given_name: input.givenName ?? '',
      family_name: input.familyName ?? '',
    }),
  });
  if (!res.ok) {
    throw new Error(`apple sign-in failed: ${res.status}`);
  }
  const json = (await res.json()) as SessionResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    user: json.user,
  };
}

// me returns the currently authenticated user, relying on apiFetch to attach
// the Bearer token and refresh on 401.
export async function me(): Promise<User> {
  const res = await apiFetch('/me');
  if (!res.ok) {
    throw new Error(`me failed: ${res.status}`);
  }
  return (await res.json()) as User;
}

// passwordLogin posts to /auth/password-login with the test user's
// credentials. The endpoint is mounted in production too — access is
// gated by the secret tap pattern on the landing screen, not by any
// build flag, so the same code path serves both Apple beta review and
// the Maestro E2E flow.
export async function passwordLogin(input: {
  email: string;
  password: string;
}): Promise<Session> {
  const res = await fetch(`${API_URL}/auth/password-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
  });
  if (!res.ok) {
    throw new Error(`password login failed: ${res.status}`);
  }
  const json = (await res.json()) as SessionResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    user: json.user,
  };
}

// logout asks the backend to revoke the given refresh token. Errors are
// swallowed — clearing local tokens is the source of truth for sign-out.
export async function logout(refreshToken: string): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // ignore
  }
}
