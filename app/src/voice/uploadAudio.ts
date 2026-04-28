// uploadAudio is the only place that knows the full three-step audio
// upload contract:
//
//   1. POST /records/{id}/audio/upload-url   → {upload_url, audio_s3_key}
//   2. PUT  {upload_url}                      → bytes to S3
//   3. PATCH /records/{id}                    → audio_s3_key persisted
//
// Steps 1+3 hit our backend; step 2 hits S3 directly. Any of them can
// fail. The user's experience must be:
//
//   - retries are safe (idempotent — same record_id, same orchestrator)
//   - successful upload removes the local copy immediately
//   - any failure leaves the LocalAudio in 'failed' state with a
//     meaningful last_error for the drafts UI
//   - "already attached" is treated as success for cleanup purposes
//     (another device finished it; we just clean up our local copy)
//
// PostHog is instrumented at every transition so a failed upload report
// from a user can be triaged without device logs: which step failed, the
// HTTP status, the (truncated) error body, and per-step durations all
// land in the event stream alongside a session replay.

import { captureEvent, captureException } from '../analytics/events';
import {
  attachAudioToRecord,
  requestAudioUploadUrl,
  uploadAudioToS3,
} from '../api/records';
import * as draftStore from '../drafts/draftStore';

export type UploadResult =
  | { status: 'uploaded' }
  | { status: 'already_attached' }
  | { status: 'failed'; error: string };

type UploadStep = 'presign' | 's3_put' | 'attach' | 'unknown';

// uploadAudio drives one record's audio through the three-step flow.
// Concurrency: the LocalAudio is flipped to 'uploading' first, which
// is both a UI signal and a soft lock — the drafts screen disables
// the button while the row is in this state. We don't enforce a hard
// cross-process lock; the worst case is two devices racing, and the
// 409 path handles that.
export async function uploadAudio(recordID: string): Promise<UploadResult> {
  const draft = await draftStore.get(recordID);
  if (!draft) {
    captureEvent('audio_upload_skipped', {
      record_id: recordID,
      reason: 'no_local_audio',
    });
    return { status: 'failed', error: 'no local audio for this record' };
  }
  if (draft.upload_status === 'uploading') {
    captureEvent('audio_upload_skipped', {
      record_id: recordID,
      reason: 'already_uploading',
    });
    return { status: 'failed', error: 'already uploading' };
  }

  captureEvent('audio_upload_started', {
    record_id: recordID,
    audio_duration_ms: draft.audio_duration_ms,
    prior_status: draft.upload_status,
    is_retry: draft.upload_status === 'failed',
  });

  await draftStore.setStatus(recordID, 'uploading');

  const startedAt = Date.now();
  let step: UploadStep = 'unknown';

  try {
    // Step 1: presigned URL. May expire (5 min) if the user lingered
    // in the drafts screen — we treat that the same as any other
    // failure here and retry on next user gesture.
    //
    // Under EXPO_PUBLIC_E2E_AUDIO_FIXTURE the recorder + STT are
    // stubbed (see recorder.ts / whisperEngine.ts), but this upload
    // path is NOT — CI runs against a real MinIO behind the same S3
    // contract, so failures here catch real device-side bugs.
    step = 'presign';
    const presignStart = Date.now();
    const presigned = await requestAudioUploadUrl(recordID);
    captureEvent('audio_upload_presigned', {
      record_id: recordID,
      audio_s3_key: presigned.audio_s3_key,
      duration_ms: Date.now() - presignStart,
    });

    // Step 2: S3 PUT. This is the slow one (audio bytes over the
    // network). Errors here are usually network-related.
    step = 's3_put';
    const s3Start = Date.now();
    await uploadAudioToS3(presigned, draft.audio_path);
    captureEvent('audio_upload_s3_put_succeeded', {
      record_id: recordID,
      audio_s3_key: presigned.audio_s3_key,
      audio_duration_ms: draft.audio_duration_ms,
      duration_ms: Date.now() - s3Start,
    });

    // Step 3: PATCH. The backend HEAD-checks S3 before flipping
    // audio_s3_key, so a successful response means the row truly
    // points at our object.
    step = 'attach';
    const attachStart = Date.now();
    try {
      await attachAudioToRecord(recordID, presigned.audio_s3_key);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === 'audio_already_attached') {
        // Another device PATCHed first — we lose the race but the
        // record is in the desired final state; clean up our local
        // copy and report it as a benign outcome.
        captureEvent('audio_upload_already_attached', {
          record_id: recordID,
          audio_s3_key: presigned.audio_s3_key,
          total_duration_ms: Date.now() - startedAt,
        });
        await draftStore.remove(recordID);
        return { status: 'already_attached' };
      }
      throw err;
    }
    captureEvent('audio_upload_attached', {
      record_id: recordID,
      audio_s3_key: presigned.audio_s3_key,
      duration_ms: Date.now() - attachStart,
    });

    // All three steps succeeded — drop the local copy.
    captureEvent('audio_upload_succeeded', {
      record_id: recordID,
      audio_s3_key: presigned.audio_s3_key,
      audio_duration_ms: draft.audio_duration_ms,
      total_duration_ms: Date.now() - startedAt,
    });
    await draftStore.remove(recordID);
    return { status: 'uploaded' };
  } catch (err) {
    const e = err as Error & { status?: number; body?: string; code?: string };
    const msg = err instanceof Error ? err.message : String(err);

    // Surface enough detail for triage without putting transcripts or
    // tokens into PostHog: step, HTTP status, error name/code, body
    // excerpt (already truncated by httpError).
    const props = {
      record_id: recordID,
      step,
      error_message: msg,
      error_name: err instanceof Error ? err.name : 'Unknown',
      error_code: e.code,
      http_status: e.status,
      response_body: e.body,
      total_duration_ms: Date.now() - startedAt,
      audio_duration_ms: draft.audio_duration_ms,
    };
    captureEvent('audio_upload_failed', props);
    captureException(err, props);
    // Mirror to the device console so Metro / Xcode / Android Studio
    // logs show the same context during local dev.
    console.error('[uploadAudio] failed', props);

    await draftStore.setStatus(recordID, 'failed', msg);
    return { status: 'failed', error: msg };
  }
}
