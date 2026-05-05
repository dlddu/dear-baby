// Wire-format types and helpers for the case-branching onboarding
// (PRD-006 AC-006-01~04). The single submit endpoint accepts the full
// child list; photos go through a 2-step presigned upload first so the
// device uploads bytes directly to S3.

import { apiFetch } from './client';
import type { User } from './types';

export type OnboardingCase = 'A' | 'B' | 'C';
export type ChildKind = 'fetus' | 'child';
export type ChildGender = 'male' | 'female' | 'undecided';
export type RecordPurpose =
  | 'book_making'
  | 'memory_keeping'
  | 'family_share'
  | 'emotion_diary';

export type ChildPhotoFormat = 'jpeg' | 'png' | 'heic';

export type ChildSubmission = {
  kind: ChildKind;
  display_name?: string;
  gender: ChildGender;
  introduction?: string;
  birth_date?: string; // YYYY-MM-DD (kind=child only)
  pregnancy_weeks?: number; // kind=fetus only
  due_date?: string; // YYYY-MM-DD (kind=fetus only)
  photo_tmp_key?: string; // returned by requestChildPhotoUploadURL
  purposes: RecordPurpose[];
};

export type CaseSubmission = {
  case: OnboardingCase;
  children: ChildSubmission[];
};

export type ChildRow = {
  id: string;
  user_id: string;
  kind: ChildKind;
  display_name: string | null;
  gender: ChildGender;
  introduction: string | null;
  photo_s3_key: string | null;
  birth_date: string | null;
  pregnancy_weeks: number | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CaseSubmissionResponse = {
  user: User | null;
  children: ChildRow[];
};

export async function submitCaseOnboarding(
  payload: CaseSubmission,
): Promise<CaseSubmissionResponse> {
  const res = await apiFetch('/onboarding/case', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`submitCaseOnboarding failed: ${res.status}`);
  }
  return (await res.json()) as CaseSubmissionResponse;
}

// PhotoUploadURL is the response shape of POST /onboarding/children/photo/upload-url.
// photo_tmp_key MUST be stashed alongside the other child fields and
// passed through verbatim on submitCaseOnboarding — the client does
// not assemble S3 keys.
export type PhotoUploadURL = {
  upload_url: string;
  method: string;
  expires_at: string;
  content_type: string;
  max_bytes: number;
  photo_tmp_key: string;
};

export async function requestChildPhotoUploadURL(
  format: ChildPhotoFormat,
): Promise<PhotoUploadURL> {
  const res = await apiFetch('/onboarding/children/photo/upload-url', {
    method: 'POST',
    body: JSON.stringify({ format }),
  });
  if (!res.ok) {
    throw new Error(`requestChildPhotoUploadURL failed: ${res.status}`);
  }
  return (await res.json()) as PhotoUploadURL;
}

// uploadChildPhotoToS3 mirrors uploadAudioToS3 in voice/uploadAudio: a
// raw PUT to the presigned URL with the matching Content-Type. RN's
// fetch supports `{uri}` bodies for native file streaming.
export async function uploadChildPhotoToS3(
  presigned: PhotoUploadURL,
  fileUri: string,
): Promise<void> {
  const ext = extensionForContentType(presigned.content_type);
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
    const detail = await readS3ErrorDetail(res);
    const status = res.statusText
      ? `${res.status} ${res.statusText}`
      : `${res.status}`;
    throw new Error(
      `uploadChildPhotoToS3 ${method} failed: ${status}${detail}`,
    );
  }
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/heic':
      return 'heic';
    default:
      return 'jpg';
  }
}

async function readS3ErrorDetail(res: Response): Promise<string> {
  const reqId = res.headers.get('x-amz-request-id') ?? '';
  let body = '';
  try {
    body = await res.text();
  } catch {
    // body unreadable; status alone is still useful.
  }
  const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? '';
  const msg = body.match(/<Message>([^<]+)<\/Message>/)?.[1] ?? '';
  const parts: string[] = [];
  if (code) parts.push(`code=${code}`);
  if (msg) parts.push(`msg=${msg}`);
  if (reqId) parts.push(`req=${reqId}`);
  return parts.length ? ` (${parts.join(' ')})` : '';
}

async function fileUriToBlob(uri: string): Promise<Blob> {
  const r = await fetch(uri);
  return r.blob();
}
