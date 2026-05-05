import { apiFetch } from './client';
import type { User } from './types';

// PatchMeBody is the small flag-mutation body for PATCH /me. Today the
// only field is dismiss_voice_coachmark. Onboarding completion uses POST
// /onboarding/case (a richer payload).
export type PatchMeBody = { dismiss_voice_coachmark: true };

// patchMe dismisses the home voice coachmark. The backend stamps a
// timestamp that persists across devices.
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
