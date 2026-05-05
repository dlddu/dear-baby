import { apiFetch } from './client';
import type { User } from './types';

// PatchMeBody — today the only field the backend accepts is the
// home-screen voice coachmark dismissal. Onboarding completion lives on
// POST /onboarding/case (PRD-006).
export type PatchMeBody = { dismiss_voice_coachmark: true };

// patchMe dismisses the home voice coachmark and returns the updated
// user. Any other body is rejected by the backend with 400.
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
