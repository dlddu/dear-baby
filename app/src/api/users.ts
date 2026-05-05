import { apiFetch } from './client';
import type { User } from './types';

// PatchMeBody is intentionally narrow today — the only supported PATCH
// is dismissing the home-screen voice coachmark. The case-branching
// submission goes through POST /onboarding/case.
export type PatchMeBody = { dismiss_voice_coachmark: true };

// patchMe currently only accepts the voice coachmark dismissal. The
// backend rejects other shapes with 400.
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
