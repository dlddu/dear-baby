import { apiFetch } from './client';
import type { User } from './types';

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

// Case B 의 child·fetus payload — A·C 와 wire shape 가 같다.
// 양육 아이는 B2-Purpose 1:1 화면에서 받은 child.purposes 를 그대로 보내고,
// 태아는 B6 단일 칩 그리드의 결과를 모든 fetus 행에 복제해서 보낸다 (Case A
// 와 같은 모델). 서버는 받은 그대로 저장 — 복제 책임은 클라이언트.
export type CaseBChildPayload = CaseCChildPayload;
export type CaseBFetusPayload = CaseAFetusPayload;

export type CaseBPayload = {
  due_date: string | null;
  children: CaseBChildPayload[];
  fetuses: CaseBFetusPayload[];
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

// submitOnboardingCaseB finalizes Case B onboarding — persists both
// children + fetuses rows in a single transaction, stamps onboarded_at,
// and returns the refreshed /me Profile. Each child / fetus carries its
// own purposes selection (Case A·C 의 단일 슬롯 복제와 다른 모델).
export async function submitOnboardingCaseB(
  payload: CaseBPayload,
): Promise<User> {
  const res = await apiFetch('/me/onboarding/case-b', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`submitOnboardingCaseB failed: ${res.status}`);
  }
  return (await res.json()) as User;
}
