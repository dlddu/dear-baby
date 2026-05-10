import { apiFetch } from './client';
import type { User } from './types';

// PatchMeBody is a discriminated union — a single PATCH /me call either
// completes Stage 1 onboarding OR dismisses the home voice coachmark,
// never both. The backend rejects mixed payloads with 400.
export type PatchMeBody =
  | { due_date: string | null }
  | { dismiss_voice_coachmark: true };

// patchMe updates the authenticated user's onboarding-related fields. For
// Stage 1 pass `{due_date: ...}`; null marks the user as onboarded without
// a chosen date (the "아직 정해지지 않았어요" escape hatch). For the home
// coachmark pass `{dismiss_voice_coachmark: true}` when the user closes
// the coachmark.
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

// CaseAFetusPayload mirrors the wire shape — purposes are Korean chip
// labels copied verbatim from `OnboardingContext.purposes`. The client
// replicates the same purposes array to every fetus before sending.
export type CaseAFetusPayload = {
  nickname?: string | null;
  gender?: string | null;
  pregnancy_week?: number | null;
  due_date?: string | null;
  purposes: string[];
};

export type CaseAPayload = {
  due_date: string | null;
  fetuses: CaseAFetusPayload[];
};

export type CaseCChildPayload = {
  name?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  bio?: string | null;
  purposes: string[];
};

export type CaseCPayload = {
  children: CaseCChildPayload[];
};

// submitOnboardingCaseA finalizes Case A onboarding — persists the
// fetuses + due_date, stamps onboarded_at, and returns the refreshed
// /me Profile. Called from `OnboardingContext.completeAsA`.
export async function submitOnboardingCaseA(
  payload: CaseAPayload,
): Promise<User> {
  const res = await apiFetch('/me/onboarding/case-a', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`submitOnboardingCaseA failed: ${res.status}`);
  }
  return (await res.json()) as User;
}

// submitOnboardingCaseC finalizes Case C onboarding — persists children
// rows, stamps onboarded_at with due_date null, and returns the
// refreshed /me Profile.
export async function submitOnboardingCaseC(
  payload: CaseCPayload,
): Promise<User> {
  const res = await apiFetch('/me/onboarding/case-c', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`submitOnboardingCaseC failed: ${res.status}`);
  }
  return (await res.json()) as User;
}
