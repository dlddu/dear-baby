// uploadPhoto runs the two-step child-photo upload flow:
//
//   1. POST /onboarding/children/photo/upload-url → {upload_url, photo_tmp_key}
//   2. PUT  {upload_url}                          → bytes to S3
//
// On success the caller persists `photo_tmp_key` into the onboarding
// draft. The third step (rename to permanent location) happens
// server-side when POST /onboarding/case lands. If the user abandons
// the funnel before submitting, reset-onboarding wipes the orphaned
// onboarding-tmp object.
//
// Mirrors the audio upload pattern in src/voice/uploadAudio.ts; kept
// separate so dependencies (image-picker formats vs. audio formats)
// don't tangle.

import {
  requestChildPhotoUploadURL,
  uploadChildPhotoToS3,
  type ImageFormat,
} from '../api/onboarding';

// formatFromUri inspects the local file's extension so we can request
// a presigned URL whose Content-Type matches what's actually on disk.
// Falls back to JPEG, which is what every image picker delivers when
// the user grants the photo-library permission.
export function formatFromUri(uri: string): ImageFormat {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'heic';
  if (lower.endsWith('.png')) return 'png';
  return 'jpeg';
}

export type UploadPhotoResult = {
  status: 'uploaded';
  photoTmpKey: string;
} | {
  status: 'failed';
  error: string;
};

// uploadPhoto returns either the photo_tmp_key (success) or an error
// message. The caller is responsible for retry — failure leaves the
// local URI intact so the user can try again without re-picking.
export async function uploadPhoto(fileUri: string): Promise<UploadPhotoResult> {
  try {
    const presigned = await requestChildPhotoUploadURL(formatFromUri(fileUri));
    await uploadChildPhotoToS3(presigned, fileUri);
    return { status: 'uploaded', photoTmpKey: presigned.photo_tmp_key };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'failed', error: msg };
  }
}
