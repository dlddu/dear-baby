import { apiFetch } from './client';
import type {
  CreateRecordResponse,
  PresignAudioUploadResponse,
  Record,
  RecordSource,
} from './types';

// createTextRecord POSTs a text entry to the backend. The response includes
// the updated user (with first_record_at stamped) so AuthContext can refresh
// local state in one round-trip — this is what unblurs the Stage 2 AI
// preview on the home screen.
export async function createTextRecord(
  content: string,
): Promise<CreateRecordResponse> {
  return createRecord(content, 'text');
}

// createVoiceRecord behaves like createTextRecord but flags the source
// as voice. The backend persists the row immediately with audio_s3_key
// = NULL — the client may attach the audio later via the upload URL +
// PATCH flow, or never.
export async function createVoiceRecord(
  content: string,
): Promise<CreateRecordResponse> {
  return createRecord(content, 'voice');
}

async function createRecord(
  content: string,
  source: RecordSource,
): Promise<CreateRecordResponse> {
  const res = await apiFetch('/records', {
    method: 'POST',
    body: JSON.stringify({ content, source }),
  });
  if (!res.ok) {
    throw new Error(`createRecord(${source}) failed: ${res.status}`);
  }
  return (await res.json()) as CreateRecordResponse;
}

// requestAudioUploadUrl asks the backend for a presigned PUT URL +
// canonical S3 key for this record's audio. The URL has a short TTL;
// callers should consume it immediately and request a fresh one on
// expiry rather than caching.
export async function requestAudioUploadUrl(
  recordID: string,
): Promise<PresignAudioUploadResponse> {
  const res = await apiFetch(`/records/${recordID}/audio/upload-url`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`requestAudioUploadUrl failed: ${res.status}`);
  }
  return (await res.json()) as PresignAudioUploadResponse;
}

// uploadAudioToS3 PUTs the local audio file directly to S3 using the
// presigned URL. Returns true on 2xx, throws otherwise. Note: this
// bypasses apiFetch on purpose — the URL is signed for S3, not for our
// backend, and adding our Authorization header would be rejected.
export async function uploadAudioToS3(
  url: string,
  fileUri: string,
): Promise<void> {
  const blob = await (await fetch(fileUri)).blob();
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'audio/m4a' },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`uploadAudioToS3 failed: ${res.status}`);
  }
}

// attachAudioToRecord PATCHes the record with the canonical key the
// backend issued. The backend re-derives the expected key from
// (user, record) and rejects mismatches, so the client must echo the
// value from requestAudioUploadUrl unchanged.
export async function attachAudioToRecord(
  recordID: string,
  audioS3Key: string,
): Promise<Record> {
  const res = await apiFetch(`/records/${recordID}`, {
    method: 'PATCH',
    body: JSON.stringify({ audio_s3_key: audioS3Key }),
  });
  if (!res.ok) {
    throw new Error(`attachAudioToRecord failed: ${res.status}`);
  }
  return (await res.json()) as Record;
}
