// uploadPhoto orchestrates the 2-step image upload contract for the
// case-branching onboarding photo input:
//
//   1. POST /onboarding/children/photo/upload-url → {upload_url, photo_tmp_key}
//   2. PUT  {upload_url}                          → bytes to S3
//
// The photo_tmp_key is then stashed on the corresponding ChildDraft and
// passed verbatim to POST /onboarding/case at the end of the funnel,
// where the server renames it to its permanent location.
//
// Mirrors voice/uploadAudio's structure but with image format detection
// instead of audio.

import {
  requestChildPhotoUploadURL,
  uploadChildPhotoToS3,
  type ChildPhotoFormat,
  type PhotoUploadURL,
} from '../api/onboarding';

export type UploadPhotoResult = {
  photo_tmp_key: string;
  format: ChildPhotoFormat;
  upload_url: PhotoUploadURL;
};

// formatFromUri inspects the local file's extension. Falls back to JPEG
// when the extension is missing/unknown (gallery thumbnails sometimes
// return URIs without a clear suffix on iOS).
export function formatFromUri(uri: string): ChildPhotoFormat {
  const lower = uri.toLowerCase().split('?')[0];
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'heic';
  return 'jpeg';
}

export async function uploadPhoto(uri: string): Promise<UploadPhotoResult> {
  const format = formatFromUri(uri);
  const presigned = await requestChildPhotoUploadURL(format);
  await uploadChildPhotoToS3(presigned, uri);
  return { photo_tmp_key: presigned.photo_tmp_key, format, upload_url: presigned };
}
