import { apiFetch } from './client';
import type { CreateRecordResponse } from './types';

// createTextRecord POSTs a text entry to the backend. The response includes
// the updated user (with first_record_at stamped) so AuthContext can refresh
// local state in one round-trip — this is what unblurs the Stage 2 AI
// preview on the home screen.
export async function createTextRecord(
  content: string,
): Promise<CreateRecordResponse> {
  const res = await apiFetch('/records', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`createTextRecord failed: ${res.status}`);
  }
  return (await res.json()) as CreateRecordResponse;
}
