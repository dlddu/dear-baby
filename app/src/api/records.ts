import { Platform } from 'react-native';

import { posthogClient } from '../analytics/client';
import { apiFetch } from './client';
import type { CreateRecordResponse, Record, RecordVisibility } from './types';

// AudioFormat mirrors storage.AudioFormat on the backend. iOS records
// linear-PCM .wav (whisper-friendly, no AAC decode); Android records
// AAC-in-MP4 .m4a. The server uses this to build the matching S3 key
// and to lock the presigned PUT to the right Content-Type.
export type AudioFormat = 'm4a' | 'wav';

export function platformAudioFormat(): AudioFormat {
  return Platform.OS === 'ios' ? 'wav' : 'm4a';
}

// CreateRecordOptions packages the optional fields callers pass to
// create{Text,Voice}Record. subjectId is REQUIRED — the backend rejects
// records without one. visibility defaults to 'private' on the server
// when omitted, matching the user-trust-first policy.
export type CreateRecordOptions = {
  subjectId: string;
  questionText?: string;
  visibility?: RecordVisibility;
};

// createTextRecord POSTs a text entry to the backend. The response includes
// the updated user (with first_record_at stamped) so AuthContext can refresh
// local state in one round-trip — this is what unblurs the Stage 2 AI
// preview on the home screen. `subjectId` ties the record to a fetus /
// child via record_subjects. `questionText` is the daily question the
// home screen showed when the user started writing; pass undefined when
// no question is associated.
export async function createTextRecord(
  content: string,
  options: CreateRecordOptions,
): Promise<CreateRecordResponse> {
  const payload: {
    content: string;
    subject_id: string;
    question_text?: string;
    visibility?: RecordVisibility;
  } = { content, subject_id: options.subjectId };
  if (options.questionText) payload.question_text = options.questionText;
  if (options.visibility) payload.visibility = options.visibility;
  const res = await apiFetch('/records', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`createTextRecord failed: ${res.status}`);
  }
  const body = (await res.json()) as CreateRecordResponse;
  posthogClient?.capture('record_posted', {
    source: 'text',
    content_length: content.length,
    has_question: Boolean(options.questionText),
    record_id: body.record.id,
  });
  return body;
}

// createVoiceRecord POSTs a voice-source entry to the backend. The audio
// blob is uploaded separately via requestAudioUploadUrl + S3 PUT +
// attachAudioToRecord — this call only commits the transcript, which
// is the authoritative artifact and triggers first_record_at.
export async function createVoiceRecord(
  content: string,
  options: CreateRecordOptions,
): Promise<CreateRecordResponse> {
  const payload: {
    content: string;
    source: 'voice';
    subject_id: string;
    question_text?: string;
    visibility?: RecordVisibility;
  } = {
    content,
    source: 'voice',
    subject_id: options.subjectId,
  };
  if (options.questionText) payload.question_text = options.questionText;
  if (options.visibility) payload.visibility = options.visibility;
  const res = await apiFetch('/records', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`createVoiceRecord failed: ${res.status}`);
  }
  const body = (await res.json()) as CreateRecordResponse;
  posthogClient?.capture('record_posted', {
    source: 'voice',
    content_length: content.length,
    has_question: Boolean(options.questionText),
    record_id: body.record.id,
  });
  return body;
}

// ListRecordsOptions narrows the diary list. subjectIds defaults to "all
// subjects the user owns" when empty; visibility defaults to "both"
// when undefined. limit caps page size (server clamps at 100). cursor
// is opaque — pass through from a prior response.
export type ListRecordsOptions = {
  subjectIds?: string[];
  visibility?: RecordVisibility;
  cursor?: string;
  limit?: number;
};

export type ListRecordsResponse = {
  records: Record[];
  next_cursor: string;
};

// listRecords fetches the diary tab page. The server returns records
// newest-first; the diary tab groups them into month sections at render
// time. next_cursor is empty when there's no further page.
export async function listRecords(
  options: ListRecordsOptions = {},
): Promise<ListRecordsResponse> {
  const params = new URLSearchParams();
  if (options.subjectIds) {
    for (const id of options.subjectIds) {
      if (id) params.append('subject_id', id);
    }
  }
  if (options.visibility) params.set('visibility', options.visibility);
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.limit != null) params.set('limit', String(options.limit));
  const qs = params.toString();
  const url = qs ? `/records?${qs}` : '/records';
  const res = await apiFetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`listRecords failed: ${res.status}`);
  }
  return (await res.json()) as ListRecordsResponse;
}

// getRecord fetches a single record. Used by the diary detail screen.
export async function getRecord(id: string): Promise<Record> {
  const res = await apiFetch(`/records/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
  if (!res.ok) {
    throw new Error(`getRecord failed: ${res.status}`);
  }
  const body = (await res.json()) as { record: Record };
  return body.record;
}

// updateRecordContent edits the body of an existing record. Used by the
// diary edit screen (PRD-008 AC-008-05).
export async function updateRecordContent(
  id: string,
  content: string,
): Promise<Record> {
  const res = await apiFetch(`/records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`updateRecordContent failed: ${res.status}`);
  }
  const body = (await res.json()) as { record: Record };
  return body.record;
}

// updateRecordVisibility flips a record's public/private state. Used
// by the diary detail screen's action sheet (PRD-008 AC-008-07).
export async function updateRecordVisibility(
  id: string,
  visibility: RecordVisibility,
): Promise<Record> {
  const res = await apiFetch(`/records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ visibility }),
  });
  if (!res.ok) {
    throw new Error(`updateRecordVisibility failed: ${res.status}`);
  }
  const body = (await res.json()) as { record: Record };
  return body.record;
}

// deleteRecord hard-deletes a record. Used by the diary detail screen's
// action sheet (PRD-008 AC-008-06). The server intentionally does not
// clean up companion S3 audio synchronously; a sweep handles orphans.
export async function deleteRecord(id: string): Promise<void> {
  const res = await apiFetch(`/records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`deleteRecord failed: ${res.status}`);
  }
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
  format: AudioFormat = platformAudioFormat(),
): Promise<AudioUploadURL> {
  const res = await apiFetch(`/records/${encodeURIComponent(recordID)}/audio/upload-url`, {
    method: 'POST',
    body: JSON.stringify({ format }),
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
  // dev / unit tests). The form-data `name` is cosmetic (S3 ignores
  // it) but we keep it aligned with the actual extension so debug
  // tooling shows a sensible filename.
  const ext = presigned.content_type === 'audio/wav' ? 'wav' : 'm4a';
  const body =
    typeof fileUri === 'string' && fileUri.startsWith('file://')
      ? // RN-only shape; harmless on web because we never reach this in dev
        ({ uri: fileUri, type: presigned.content_type, name: `audio.${ext}` } as unknown as BodyInit)
      : await fileUriToBlob(fileUri);

  const method = presigned.method || 'PUT';
  let res: Response;
  try {
    res = await fetch(presigned.upload_url, {
      method,
      headers: { 'Content-Type': presigned.content_type },
      body,
    });
  } catch (err) {
    // fetch only rejects on transport-level failure (offline, DNS,
    // TLS, aborted). HTTP error status never lands here — that's the
    // !res.ok path below. Surface the underlying cause so a generic
    // "Network request failed" doesn't bury the real reason.
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`uploadAudioToS3 ${method} network error: ${cause}`);
  }

  if (!res.ok) {
    // S3 reports failures as XML: <Error><Code/><Message/><RequestId/></Error>.
    // Extracting those turns "failed: 403" into an actionable message
    // like "403 Forbidden (code=SignatureDoesNotMatch req=ABC…)".
    const detail = await readS3ErrorDetail(res);
    const status = res.statusText
      ? `${res.status} ${res.statusText}`
      : `${res.status}`;
    throw new Error(`uploadAudioToS3 ${method} failed: ${status}${detail}`);
  }
}

async function readS3ErrorDetail(res: Response): Promise<string> {
  const reqId = res.headers.get('x-amz-request-id') ?? '';
  let body = '';
  try {
    body = await res.text();
  } catch {
    // Body unreadable (network drop after headers, or body already
    // consumed elsewhere). Status + request id is still useful on its
    // own — fall through with whatever we have.
  }
  const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? '';
  const msg = body.match(/<Message>([^<]+)<\/Message>/)?.[1] ?? '';
  const parts: string[] = [];
  if (code) parts.push(`code=${code}`);
  if (msg) parts.push(`msg=${msg}`);
  if (reqId) parts.push(`req=${reqId}`);
  return parts.length ? ` (${parts.join(' ')})` : '';
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
