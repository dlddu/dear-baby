import * as FileSystem from 'expo-file-system/legacy';

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
// presigned URL. Throws on non-2xx. Bypasses apiFetch on purpose — the
// URL is signed for S3, not for our backend, and adding our
// Authorization header would invalidate the signature.
//
// Why FileSystem.uploadAsync (not fetch + blob): RN's fetch on a
// file:// URI followed by a PUT of the resulting blob silently mutates
// the request shape (extra headers, chunked encoding, charset on
// Content-Type) which trips MinIO/S3's SigV4 verification with a 403.
// uploadAsync delegates to NSURLSession / OkHttp which honor the exact
// headers we set and stream the file unchanged.
export async function uploadAudioToS3(
  url: string,
  fileUri: string,
): Promise<void> {
  const res = await FileSystem.uploadAsync(url, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': 'audio/m4a' },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`uploadAudioToS3 failed: ${res.status} ${res.body}`);
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
