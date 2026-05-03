// PRD-006 케이스 분기 온보딩 API client. Wraps the four submit endpoints
// the funnel uses (case answers, 단태/다태 toggle, children batch, complete).
// Each call returns void on 204; non-2xx responses throw.

import { apiFetch } from './client';

export type CaseAnswers = {
  is_pregnant: boolean;
  has_children: boolean;
};

// ChildSubmit is the per-child shape the backend's POST /onboarding/children
// expects. Field names match the wire format byte-for-byte so the draft
// store can serialize directly.
export type ChildSubmit = {
  status: 'parenting' | 'pregnancy';
  name: string | null;
  gender: 'female' | 'male' | 'unknown';
  birth_date: string | null;
  due_date: string | null;
  pregnancy_week: number | null;
  bio: string | null;
  photo_s3_key: string | null;
  is_due_date_undecided: boolean;
  purposes: string[];
};

export async function setCase(answers: CaseAnswers): Promise<void> {
  const res = await apiFetch('/onboarding/case', {
    method: 'POST',
    body: JSON.stringify(answers),
  });
  if (!res.ok) {
    throw new Error(`setCase failed: ${res.status}`);
  }
}

export async function setMultiplePregnancy(value: boolean): Promise<void> {
  const res = await apiFetch('/onboarding/multiple-pregnancy', {
    method: 'POST',
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    throw new Error(`setMultiplePregnancy failed: ${res.status}`);
  }
}

export async function submitChildren(children: ChildSubmit[]): Promise<void> {
  const res = await apiFetch('/onboarding/children', {
    method: 'POST',
    body: JSON.stringify({ children }),
  });
  if (!res.ok) {
    throw new Error(`submitChildren failed: ${res.status}`);
  }
}

export async function completeOnboarding(): Promise<void> {
  const res = await apiFetch('/onboarding/complete', { method: 'POST' });
  if (!res.ok) {
    throw new Error(`completeOnboarding failed: ${res.status}`);
  }
}
