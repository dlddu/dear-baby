import { apiFetch } from './client';
import type { CreateRecordResponse, Record } from './types';

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

// createVoiceRecord POSTs a voice-source entry to the backend. The audio
// blob is uploaded separately via requestAudioUploadUrl + S3 PUT +
// attachAudioToRecord — this call only commits the transcript, which
// is the authoritative artifact and triggers first_record_at.
export async function createVoiceRecord(
  content: string,
): Promise<CreateRecordResponse> {
  const res = await apiFetch('/records', {
    method: 'POST',
    body: JSON.stringify({ content, source: 'voice' }),
  });
  if (!res.ok) {
    throw new Error(`createVoiceRecord failed: ${res.status}`);
  }
  return (await res.json()) as CreateRecordResponse;
}

// AudioUploadURL is the response shape of POST /records/{id}/audio/upload-url.
// audio_s3_key MUST be passed back verbatim in the PATCH that follows —
// the client does not assemble it itself.
export type AudioUploadURL = {
  upload_url: string;
  method: string;
  expires_at: string;
  content_type: string;
  max_bytes: number;
  audio_s3_key: string;
};

export async function requestAudioUploadUrl(
  recordID: string,
): Promise<AudioUploadURL> {
  const res = await apiFetch(`/records/${encodeURIComponent(recordID)}/audio/upload-url`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`requestAudioUploadUrl failed: ${res.status}`);
  }
  return (await res.json()) as AudioUploadURL;
}

// uploadAudioToS3 performs the presigned PUT. The Content-Type and the
// 25 MiB ceiling must match what the server presigned, otherwise S3
// answers with SignatureDoesNotMatch.
export async function uploadAudioToS3(
  presigned: AudioUploadURL,
  fileUri: string,
): Promise<void> {
  // RN's fetch can take a `{ uri }` body for native file streaming
  // without loading the whole file into memory. We fall back to a
  // Blob / ArrayBuffer wrapper if the host doesn't support it (web
  // dev / unit tests).
  const body =
    typeof fileUri === 'string' && fileUri.startsWith('file://')
      ? // RN-only shape; harmless on web because we never reach this in dev
        ({ uri: fileUri, type: presigned.content_type, name: 'audio.m4a' } as unknown as BodyInit)
      : await fileUriToBlob(fileUri);

  const res = await fetch(presigned.upload_url, {
    method: presigned.method || 'PUT',
    headers: { 'Content-Type': presigned.content_type },
    body,
  });
  if (!res.ok) {
    throw new Error(`uploadAudioToS3 failed: ${res.status}`);
  }
}

async function fileUriToBlob(uri: string): Promise<Blob> {
  const r = await fetch(uri);
  return r.blob();
}

// attachAudioToRecord PATCHes the row with the audio_s3_key the server
// gave us in requestAudioUploadUrl. The server HEAD-checks the object
// before persisting, so a 200 here means S3 actually has the bytes.
export async function attachAudioToRecord(
  recordID: string,
  audioS3Key: string,
): Promise<{ record: Record }> {
  const res = await apiFetch(`/records/${encodeURIComponent(recordID)}`, {
    method: 'PATCH',
    body: JSON.stringify({ audio_s3_key: audioS3Key }),
  });
  if (!res.ok) {
    // 409 is "another device already attached" — surface it as a
    // typed error so the orchestrator can clean up local state.
    if (res.status === 409) {
      const err = new Error('audio already attached');
      (err as Error & { code?: string }).code = 'audio_already_attached';
      throw err;
    }
    throw new Error(`attachAudioToRecord failed: ${res.status}`);
  }
  return (await res.json()) as { record: Record };
}
