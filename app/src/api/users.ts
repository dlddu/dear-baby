import { apiFetch } from './client';
import { me as apiMe } from './auth';
import type { User } from './types';

// PatchMeBody — PRD-006 onwards, the only supported PATCH /me payload is
// the home-screen voice-coachmark dismissal. Onboarding case answers and
// children data flow through the dedicated /onboarding/* endpoints.
export type PatchMeBody = { dismiss_voice_coachmark: true };

// patchMe updates the authenticated user's coachmark-dismissal flag.
export async function patchMe(body: PatchMeBody): Promise<User> {
  const res = await apiFetch('/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`patchMe failed: ${res.status}`);
  }
  return (await res.json()) as User;
}

// refreshMe is a thin re-export to keep callers from reaching across
// modules. Used after the onboarding submit chain to pull the canonical
// User back into AuthContext (the /onboarding/* endpoints all return 204
// to keep them small, so a /me round-trip is the simplest way to mirror
// state).
export async function refreshMe(): Promise<User> {
  return apiMe();
}
