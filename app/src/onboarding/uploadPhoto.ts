// Onboarding child photo upload — mirrors voice/uploadAudio.ts in shape
// but for the simpler two-step photo flow:
//
//   1. POST /onboarding/children/photo/upload-url → {upload_url, photo_tmp_key}
//   2. PUT  {upload_url}                          → bytes to S3
//
// Step 3 (PATCH) is not needed: the photo_tmp_key is carried inside the
// case-submission payload and the server resolves it to a permanent
// children/{id}/photo.{ext} key during commit.
//
// Failure modes:
//
//   - presign fails: caller surfaces a generic "사진을 올리지 못했어요"
//   - S3 PUT fails:  same — but we keep the local file URI in the draft
//                    so the user can retry from the same photo without
//                    re-picking
//   - cancellation by the picker is signalled by a returned `canceled`
//     status (the picker resolves; we never reach upload)

import {
  requestChildPhotoUploadURL,
  uploadChildPhotoToS3,
  type ImageFormat,
} from '../api/onboarding';

export type PhotoUploadOk = {
  status: 'uploaded';
  photo_tmp_key: string;
  local_uri: string;
};

export type PhotoUploadFailed = {
  status: 'failed';
  error: string;
  local_uri: string;
};

export type PhotoUploadResult = PhotoUploadOk | PhotoUploadFailed;

// formatFromUri infers the image format the server should presign for.
// expo-image-picker hands us URIs ending in `.jpg`, `.heic`, or `.png`
// depending on the device. Anything else falls back to JPEG and the
// server re-validates the extension.
export function formatFromUri(uri: string): ImageFormat {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'heic';
  if (lower.endsWith('.png')) return 'png';
  return 'jpeg';
}

// uploadChildPhoto runs the two-step upload. Pure async — does not touch
// the draft store directly so the caller can decide how to merge the
// result (keeps the orchestrator testable without AsyncStorage stubs).
export async function uploadChildPhoto(localUri: string): Promise<PhotoUploadResult> {
  try {
    const presigned = await requestChildPhotoUploadURL(formatFromUri(localUri));
    await uploadChildPhotoToS3(presigned, localUri);
    return {
      status: 'uploaded',
      photo_tmp_key: presigned.photo_tmp_key,
      local_uri: localUri,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'failed', error: msg, local_uri: localUri };
  }
}
