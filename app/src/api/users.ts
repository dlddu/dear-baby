import { apiFetch } from './client';
import type { User } from './types';

// PatchMeBody is a discriminated union — a single PATCH /me call either
// completes Stage 1 onboarding OR dismisses the Stage 2 coachmark, never
// both. The backend rejects mixed payloads with 400.
export type PatchMeBody =
  | { due_date: string | null }
  | { dismiss_stage2_coachmark: true };

// patchMe updates the authenticated user's onboarding-related fields. For
// Stage 1 pass `{due_date: ...}`; null marks the user as onboarded without a
// chosen date (the "아직 정해지지 않았어요" escape hatch). For Stage 2 pass
// `{dismiss_stage2_coachmark: true}` when the user closes the home-screen
// coachmark.
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
