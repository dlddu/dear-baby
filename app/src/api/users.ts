import { apiFetch } from './client';
import type { User } from './types';

// patchMe updates the authenticated user's onboarding fields. Passing
// due_date=null marks the user as onboarded without a chosen date
// (the "아직 정해지지 않았어요" escape hatch from Stage 1).
export async function patchMe(body: {
  due_date: string | null;
}): Promise<User> {
  const res = await apiFetch('/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`patchMe failed: ${res.status}`);
  }
  return (await res.json()) as User;
}
