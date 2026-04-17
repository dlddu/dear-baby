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

// me returns the currently authenticated user, relying on apiFetch to attach
// the Bearer token and refresh on 401.
export async function me(): Promise<User> {
  const res = await apiFetch('/me');
  if (!res.ok) {
    throw new Error(`me failed: ${res.status}`);
  }
  return (await res.json()) as User;
}

// testLogin posts to the E2E-only /auth/test-login endpoint, which the
// backend mounts only when TEST_AUTH_ENABLED=true. It bypasses Google OAuth
// and returns a real session — use it from the Maestro flow only.
export async function testLogin(opts?: {
  email?: string;
  name?: string;
  onboarded?: boolean;
}): Promise<Session> {
  const res = await fetch(`${API_URL}/auth/test-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: opts?.email ?? '',
      name: opts?.name ?? '',
      onboarded: opts?.onboarded ?? false,
    }),
  });
  if (!res.ok) {
    throw new Error(`test login failed: ${res.status}`);
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
