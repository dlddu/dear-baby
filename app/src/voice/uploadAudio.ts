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
//   - any failure leaves the LocalAudio in 'failed' state and emits an
//     audio_upload_failed PostHog event; the user sees a "실패" badge
//     but never the raw error string
//   - "already attached" is treated as success for cleanup purposes
//     (another device finished it; we just clean up our local copy)

import {
  attachAudioToRecord,
  requestAudioUploadUrl,
  uploadAudioToS3,
} from '../api/records';
import { posthogClient } from '../analytics/client';
import * as draftStore from '../drafts/draftStore';

export type UploadResult =
  | { status: 'uploaded' }
  | { status: 'already_attached' }
  | { status: 'failed'; error: string };

// uploadAudio drives one record's audio through the three-step flow.
// Concurrency: the LocalAudio is flipped to 'uploading' first, which
// is both a UI signal and a soft lock — the drafts screen disables
// the button while the row is in this state. We don't enforce a hard
// cross-process lock; the worst case is two devices racing, and the
// 409 path handles that.
export async function uploadAudio(recordID: string): Promise<UploadResult> {
  const draft = await draftStore.get(recordID);
  if (!draft) {
    return { status: 'failed', error: 'no local audio for this record' };
  }
  if (draft.upload_status === 'uploading') {
    return { status: 'failed', error: 'already uploading' };
  }
  await draftStore.setStatus(recordID, 'uploading');
  posthogClient?.capture('audio_upload_started', {
    record_id: recordID,
    audio_duration_ms: draft.audio_duration_ms,
  });

  try {
    // Step 1: presigned URL. May expire (5 min) if the user lingered
    // in the drafts screen — we treat that the same as any other
    // failure here and retry on next user gesture.
    //
    // Under EXPO_PUBLIC_E2E_AUDIO_FIXTURE the recorder + STT are
    // stubbed (see recorder.ts / whisperEngine.ts), but this upload
    // path is NOT — CI runs against a real MinIO behind the same S3
    // contract, so failures here catch real device-side bugs.
    const presigned = await requestAudioUploadUrl(recordID);

    // Step 2: S3 PUT. This is the slow one (audio bytes over the
    // network). Errors here are usually network-related.
    await uploadAudioToS3(presigned, draft.audio_path);

    // Step 3: PATCH. The backend HEAD-checks S3 before flipping
    // audio_s3_key, so a successful response means the row truly
    // points at our object.
    try {
      await attachAudioToRecord(recordID, presigned.audio_s3_key);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === 'audio_already_attached') {
        // Another device PATCHed first — we lose the race but the
        // record is in the desired final state; clean up our local
        // copy and report it as a benign outcome.
        await draftStore.remove(recordID);
        posthogClient?.capture('audio_upload_already_attached', {
          record_id: recordID,
        });
        return { status: 'already_attached' };
      }
      throw err;
    }

    // All three steps succeeded — drop the local copy.
    await draftStore.remove(recordID);
    posthogClient?.capture('audio_upload_succeeded', {
      record_id: recordID,
      audio_duration_ms: draft.audio_duration_ms,
    });
    return { status: 'uploaded' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await draftStore.setStatus(recordID, 'failed', msg);
    posthogClient?.capture('audio_upload_failed', {
      record_id: recordID,
      audio_duration_ms: draft.audio_duration_ms,
      error: msg,
    });
    return { status: 'failed', error: msg };
  }
}
