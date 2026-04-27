import * as FileSystem from 'expo-file-system/legacy';

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

// uploadAudioToS3 performs the presigned PUT.
//
// FileSystem.uploadAsync is the documented Expo path for binary file PUTs:
// it goes through NSURLSessionUploadTask / OkHttp with the file as the
// raw body and our explicit headers preserved. The previous implementation
// passed `{ uri, type, name }` as a top-level fetch body — that shape is
// documented as a FormData part, not a fetch body, and RN's behaviour for
// it is implementation-defined; observed against the dlddu-kubernetes
// bucket as a 403 with no useful detail in the alert.
//
// On failure we surface the S3 response body so SignatureDoesNotMatch /
// AccessDenied / ExpiredToken / etc. show up in the error message instead
// of just the bare status code — without that we're guessing at root cause.
export async function uploadAudioToS3(
  presigned: AudioUploadURL,
  fileUri: string,
): Promise<void> {
  const res = await FileSystem.uploadAsync(presigned.upload_url, fileUri, {
    httpMethod: (presigned.method || 'PUT') as 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': presigned.content_type },
    mimeType: presigned.content_type,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `uploadAudioToS3 failed: ${res.status} ${extractS3ErrorCode(res.body)}`.trim(),
    );
  }
}

// extractS3ErrorCode pulls the <Code> from S3's XML error body, falling
// back to a truncated raw body so the failure mode is identifiable from
// just the alert text.
function extractS3ErrorCode(body: string | undefined): string {
  if (!body) return '';
  const m = body.match(/<Code>([^<]+)<\/Code>/);
  if (m) return m[1];
  return body.slice(0, 200);
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
