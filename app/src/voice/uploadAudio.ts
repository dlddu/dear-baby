// Audio upload orchestrator — drives the three-step
// presign → S3 PUT → PATCH flow for one record's audio.
//
// Idempotency: every step is keyed on `record_id`. A presigned URL that
// expired during the PUT just triggers a fresh request; a successful
// PUT followed by a PATCH 409 means another device already attached
// audio for this record, in which case we drop our local copy.
//
// Concurrency: the draft store is locked to `uploading` for the
// duration of the orchestration. A second tap of the [업로드] button
// while one is in flight bails out without opening a second presigned
// URL.

import * as draftStore from '../drafts/draftStore';
import {
  attachAudioToRecord,
  requestAudioUploadUrl,
  uploadAudioToS3,
} from '../api/records';

const FIXTURE = process.env.EXPO_PUBLIC_E2E_AUDIO_FIXTURE === '1';

export type UploadAudioResult =
  | { status: 'ok' }
  | { status: 'already-attached' }
  | { status: 'failed'; error: string };

export async function uploadAudio(recordID: string): Promise<UploadAudioResult> {
  const entry = await draftStore.get(recordID);
  if (!entry) return { status: 'failed', error: 'no local audio' };
  if (entry.upload_status === 'uploading') {
    return { status: 'failed', error: 'already in progress' };
  }

  await draftStore.markUploading(recordID);

  // Fixture short-circuit: CI does not bring up S3, so the user-facing
  // outcome is what we verify. Skip the network round-trip and converge
  // on the same end state — local audio removed, no failure surfaced.
  if (FIXTURE) {
    await draftStore.remove(recordID);
    return { status: 'ok' };
  }

  try {
    // Single retry on URL expiry — covers a slow PUT that ran past the
    // 5-minute TTL. Beyond one retry we bubble the error up so the
    // user can see the failure rather than burning the network.
    let presigned = await requestAudioUploadUrl(recordID);
    try {
      await uploadAudioToS3(presigned.upload_url, entry.audio_path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('403')) {
        // S3 returns 403 for an expired signature. Refresh and retry once.
        presigned = await requestAudioUploadUrl(recordID);
        await uploadAudioToS3(presigned.upload_url, entry.audio_path);
      } else {
        throw err;
      }
    }

    try {
      await attachAudioToRecord(recordID, presigned.audio_s3_key);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('409')) {
        // Another device already attached this record's audio. The
        // server is the authority; drop our local copy.
        await draftStore.remove(recordID);
        return { status: 'already-attached' };
      }
      throw err;
    }

    // Success: server has both transcript + audio_s3_key now. The
    // local copy is no longer needed; remove it so the drafts list
    // reflects the new ground truth.
    await draftStore.remove(recordID);
    return { status: 'ok' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await draftStore.markFailed(recordID, msg);
    return { status: 'failed', error: msg };
  }
}
