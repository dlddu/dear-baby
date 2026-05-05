import { apiFetch } from './client';
import type { User } from './types';

// PatchMeBody covers the single use case the endpoint serves today —
// dismissing the home-screen voice coachmark. The case-branching
// onboarding completion lives at POST /onboarding/case (see ./onboarding).
export type PatchMeBody = { dismiss_voice_coachmark: true };

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
