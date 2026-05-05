// Two-step child-photo upload orchestrator. Mirrors the audio upload
// pattern in src/voice/uploadAudio.ts:
//
//   1. POST /onboarding/children/photo/upload-url → presigned PUT
//   2. PUT  upload_url                             → bytes to S3
//
// On success the orchestrator returns the photo_tmp_key, which the
// caller stores in the draft and later submits with POST /onboarding/case.
// The server does the rename (tmp → permanent) inside that submit.
//
// Failures bubble up as Errors with explanatory messages — no retry
// logic here; the caller's UI decides whether to show an "use original"
// retry button or skip the photo entirely (it is always optional in the
// PRD).

import {
  requestChildPhotoUploadURL,
  uploadChildPhotoToS3,
  type ImageFormat,
} from '../api/onboarding';

export type UploadedPhoto = {
  photoTmpKey: string;
  /** Local file:// URI of the picked image, retained so the UI can
   *  re-render the avatar after uploading without re-downloading. */
  localUri: string;
};

// detectImageFormat falls back to JPEG for unfamiliar extensions
// because the picker normally hands back .jpg or .heic on iOS and
// .jpg on Android. PNG only shows up if the user picks a screenshot.
function detectImageFormat(uri: string): ImageFormat {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'heic';
  if (lower.endsWith('.png')) return 'png';
  return 'jpeg';
}

export async function uploadChildPhoto(
  fileUri: string,
  format: ImageFormat = detectImageFormat(fileUri),
): Promise<UploadedPhoto> {
  const presigned = await requestChildPhotoUploadURL(format);
  await uploadChildPhotoToS3(presigned, fileUri);
  return { photoTmpKey: presigned.photo_tmp_key, localUri: fileUri };
}
