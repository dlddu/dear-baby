// Case-branched onboarding API surface.
//
//   1. POST /onboarding/children/photo/upload-url
//        → {upload_url, photo_tmp_key, content_type, expires_at, max_bytes}
//   2. PUT  {upload_url}                       (S3, off-host)
//   3. POST /onboarding/case
//        body: {case, children: [{kind, ..., photo_tmp_key?, purposes}]}
//        → {user}  (updated profile so AuthContext can flip state)
//
// Steps 1 + 3 are dear-baby endpoints; step 2 hits S3 directly. Photo
// uploads are optional — Case A flows skip the photo entirely, and
// Case B/C children may also skip without affecting validity.

import { Platform } from 'react-native';

import { apiFetch } from './client';
import type { CaseKind, User } from './types';

// ImageFormat mirrors backend storage.ImageFormat. iOS shoots HEIC by
// default but most pickers can hand back JPEG; the client tells the
// server which it intends to send so the presigned PUT's Content-Type
// matches.
export type ImageFormat = 'jpeg' | 'heic' | 'png';

export type ChildKind = 'fetus' | 'child';
export type Gender = 'male' | 'female' | 'undecided';
export type RecordPurpose =
  | 'book_making'
  | 'memory_keeping'
  | 'family_share'
  | 'emotion_diary';

// ChildPayload is one row in the POST /onboarding/case `children` array.
// kind drives which fields are required; the server validates strictly.
export type ChildPayload = {
  kind: ChildKind;
  display_name?: string;
  gender: Gender;
  introduction?: string;
  photo_tmp_key?: string;
  birth_date?: string; // YYYY-MM-DD, kind=child
  pregnancy_weeks?: number; // kind=fetus
  due_date?: string; // YYYY-MM-DD, kind=fetus
  purposes: RecordPurpose[];
};

export type CaseOnboardingPayload = {
  case: CaseKind;
  children: ChildPayload[];
};

export type ChildPhotoUploadURL = {
  upload_url: string;
  method: string;
  expires_at: string;
  content_type: string;
  max_bytes: number;
  photo_tmp_key: string;
};

// platformDefaultImageFormat picks a sensible format when the picker
// did not return a typed asset. iOS keeps HEIC (smaller, native);
// Android and web default to JPEG.
export function platformDefaultImageFormat(): ImageFormat {
  return Platform.OS === 'ios' ? 'heic' : 'jpeg';
}

export async function requestChildPhotoUploadURL(
  format: ImageFormat = platformDefaultImageFormat(),
): Promise<ChildPhotoUploadURL> {
  const res = await apiFetch('/onboarding/children/photo/upload-url', {
    method: 'POST',
    body: JSON.stringify({ format }),
  });
  if (!res.ok) {
    throw new Error(`requestChildPhotoUploadURL failed: ${res.status}`);
  }
  return (await res.json()) as ChildPhotoUploadURL;
}

// uploadChildPhotoToS3 PUTs the file bytes at the presigned URL. The
// Content-Type and (for the server signature) the URL's signed query
// parameters must match what the upload-url endpoint pinned. Mirrors
// voice/uploadAudio's S3 PUT — see app/src/api/records.ts.
export async function uploadChildPhotoToS3(
  presigned: ChildPhotoUploadURL,
  fileUri: string,
): Promise<void> {
  const ext =
    presigned.content_type === 'image/heic'
      ? 'heic'
      : presigned.content_type === 'image/png'
        ? 'png'
        : 'jpg';
  const body =
    typeof fileUri === 'string' && fileUri.startsWith('file://')
      ? ({
          uri: fileUri,
          type: presigned.content_type,
          name: `photo.${ext}`,
        } as unknown as BodyInit)
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
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`uploadChildPhotoToS3 ${method} network error: ${cause}`);
  }
  if (!res.ok) {
    const status = res.statusText
      ? `${res.status} ${res.statusText}`
      : `${res.status}`;
    throw new Error(`uploadChildPhotoToS3 ${method} failed: ${status}`);
  }
}

async function fileUriToBlob(uri: string): Promise<Blob> {
  const r = await fetch(uri);
  return r.blob();
}

export type SubmitCaseResponse = {
  user: User;
};

// submitCaseOnboarding posts the full case payload. The server
// validates field shape and case/kind alignment, persists everything in
// one transaction (with photo rename), and echoes the updated profile
// so AuthContext can flip status='onboarding' → 'authenticated'.
export async function submitCaseOnboarding(
  payload: CaseOnboardingPayload,
): Promise<User> {
  const res = await apiFetch('/onboarding/case', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.status === 204) {
    // Server accepted but didn't echo the profile. Caller should fall
    // back to /me; surface a synthetic error so callers don't silently
    // skip the refresh.
    throw new Error('submitCaseOnboarding: no user echo');
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = `: ${body.error}`;
    } catch {
      // ignore
    }
    throw new Error(`submitCaseOnboarding failed: ${res.status}${detail}`);
  }
  const json = (await res.json()) as SubmitCaseResponse;
  return json.user;
}
