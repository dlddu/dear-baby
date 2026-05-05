// uploadPhoto orchestrates the two-step child-photo upload contract:
//
//   1. POST /onboarding/children/photo/upload-url → {upload_url, photo_tmp_key}
//   2. PUT  {upload_url} → bytes to S3
//
// On success the caller should stash photo_tmp_key on the in-progress
// ChildDraft so SubmitCase can rotate it onto the permanent layout.
//
// Failure modes:
//   - Step 1 fails (auth, presign error) → throws, caller retries.
//   - Step 2 fails (network, S3 5xx) → throws; the tmp key may or may
//     not exist on S3. Submitting with that key would fail HEAD; the
//     caller should swallow the failure and re-pick.

import {
  requestChildPhotoUploadURL,
  uploadChildPhotoToS3,
  type PhotoFormat,
} from '../api/onboarding';

// formatFromUri picks the wire format off a local file URI's extension.
// iOS returns ".heic" for camera-roll HEIC images, ".jpg" for JPEG, and
// ".png" for screenshots. Anything else maps to JPEG (the device picker
// is configured to deliver JPEG in those cases anyway).
export function formatFromUri(uri: string): PhotoFormat {
  const low = uri.toLowerCase();
  if (low.endsWith('.heic') || low.endsWith('.heif')) return 'heic';
  if (low.endsWith('.png')) return 'png';
  return 'jpeg';
}

export type UploadPhotoResult = {
  photo_tmp_key: string;
};

export async function uploadChildPhoto(localUri: string): Promise<UploadPhotoResult> {
  const format = formatFromUri(localUri);
  const presigned = await requestChildPhotoUploadURL(format);
  await uploadChildPhotoToS3(presigned, localUri);
  return { photo_tmp_key: presigned.photo_tmp_key };
}
