// Case-branching onboarding API client (PRD-006 AC-006-01~04). Mirrors
// backend/internal/onboarding handlers_case.go. Three responsibilities:
//
//   1. requestChildPhotoUploadURL  — get a presigned PUT URL for an
//      onboarding-tmp photo
//   2. uploadChildPhotoToS3        — perform the PUT (S3 directly)
//   3. submitCaseOnboarding        — finalize the funnel: case + children
//      + per-child purposes + photo rename
//
// The client never names its own S3 keys; the server returns the
// `photo_tmp_key` in step 1 and that exact value flows through the
// final submit.

import { apiFetch } from './client';

// ImageFormat mirrors storage.ImageFormat on the backend. iOS phones
// produce HEIC by default; jpeg covers the camera-roll baseline. PNG is
// kept for completeness (rare in onboarding photos).
export type ImageFormat = 'jpeg' | 'heic' | 'png';

export type ChildKind = 'fetus' | 'child';
export type Gender = 'male' | 'female' | 'undecided';
export type CaseKind = 'A' | 'B' | 'C';
export type RecordPurpose =
  | 'book_making'
  | 'memory_keeping'
  | 'family_share'
  | 'emotion_diary';

// SubmitCaseChild matches backend ChildInput. All fields except `kind`,
// `gender`, and `purposes` are optional; kind-specific required fields
// (display_name + birth_date for child; pregnancy_weeks + due_date for
// fetus) are validated server-side.
export type SubmitCaseChild = {
  kind: ChildKind;
  display_name?: string;
  gender: Gender;
  introduction?: string;
  photo_tmp_key?: string;
  birth_date?: string; // YYYY-MM-DD
  pregnancy_weeks?: number;
  due_date?: string; // YYYY-MM-DD
  purposes: RecordPurpose[];
};

export type SubmitCasePayload = {
  case: CaseKind;
  children: SubmitCaseChild[];
};

// ChildPhotoUploadURL mirrors the backend uploadURLResponse. The
// photo_tmp_key MUST be passed back verbatim in the SubmitCasePayload —
// the client does not assemble it itself.
export type ChildPhotoUploadURL = {
  upload_url: string;
  method: string;
  expires_at: string;
  content_type: string;
  max_bytes: number;
  photo_tmp_key: string;
};

export async function requestChildPhotoUploadURL(
  format: ImageFormat,
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

// uploadChildPhotoToS3 performs the presigned PUT. Mirrors the audio
// equivalent in api/records.ts — the Content-Type and 10 MiB ceiling
// must match what the server presigned, otherwise S3 answers with
// SignatureDoesNotMatch.
export async function uploadChildPhotoToS3(
  presigned: ChildPhotoUploadURL,
  fileUri: string,
): Promise<void> {
  const ext = extensionForContentType(presigned.content_type);
  const body =
    typeof fileUri === 'string' && fileUri.startsWith('file://')
      ? // RN-only shape; harmless on web because we never reach this in dev
        ({ uri: fileUri, type: presigned.content_type, name: `photo.${ext}` } as unknown as BodyInit)
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

function extensionForContentType(ct: string): string {
  if (ct === 'image/heic') return 'heic';
  if (ct === 'image/png') return 'png';
  return 'jpg';
}

async function fileUriToBlob(uri: string): Promise<Blob> {
  const r = await fetch(uri);
  return r.blob();
}

// SubmitCaseResponse mirrors what the backend returns from POST
// /onboarding/case — the inserted children with their server-generated
// IDs. The client uses the IDs to populate the active-child context;
// /me is fetched separately to refresh `case_kind` + `onboarded_at`.
export type SubmitCaseResponse = {
  case: CaseKind;
  children: Array<{
    id: string;
    user_id: string;
    kind: ChildKind;
    display_name: string | null;
    gender: Gender;
    introduction: string | null;
    photo_s3_key: string | null;
    birth_date: string | null;
    pregnancy_weeks: number | null;
    due_date: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>;
};

export async function submitCaseOnboarding(
  payload: SubmitCasePayload,
): Promise<SubmitCaseResponse> {
  const res = await apiFetch('/onboarding/case', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`submitCaseOnboarding failed: ${res.status}`);
  }
  return (await res.json()) as SubmitCaseResponse;
}
