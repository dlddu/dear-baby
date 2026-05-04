// API client for the case-branching onboarding endpoints (PRD-006
// AC-006-01..04). Three calls cover the full funnel:
//
//   1. requestChildPhotoUploadURL → presigned PUT for an onboarding-tmp key
//   2. uploadChildPhotoToS3       → device uploads bytes directly to S3
//   3. submitCaseOnboarding       → commits children + purposes + case_kind,
//                                   server-side rename of any photo_tmp_keys
//                                   to permanent children/{id}/ keys
//
// Steps 1+3 hit our backend; step 2 hits S3 directly. All calls are
// idempotent at the client level — on transient failure the orchestrator
// can retry with the same payload (the server treats the same
// photo_tmp_key as "still mine" until the case submission consumes it).

import { apiFetch } from './client';
import type { User } from './types';

export type ImageFormat = 'jpeg' | 'heic' | 'png';

// PhotoUploadURL mirrors the backend response shape of
// POST /onboarding/children/photo/upload-url. `photo_tmp_key` MUST be
// passed back verbatim inside the case submission's children[] entry —
// the client never assembles it itself.
export type PhotoUploadURL = {
  upload_url: string;
  method: string;
  expires_at: string;
  content_type: string;
  max_bytes: number;
  photo_tmp_key: string;
};

export async function requestChildPhotoUploadURL(
  format: ImageFormat = 'jpeg',
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

// uploadChildPhotoToS3 performs the presigned PUT. The Content-Type and
// the 10 MiB ceiling must match what the server presigned, otherwise S3
// answers with SignatureDoesNotMatch. Mirrors uploadAudioToS3 in shape;
// kept separate so the photo and audio paths can evolve independently.
export async function uploadChildPhotoToS3(
  presigned: PhotoUploadURL,
  fileUri: string,
): Promise<void> {
  const body =
    typeof fileUri === 'string' && fileUri.startsWith('file://')
      ? // RN-only shape; harmless on web because we never reach this in dev.
        ({ uri: fileUri, type: presigned.content_type, name: 'photo' } as unknown as BodyInit)
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

// CaseKind matches the server's onboarding.Case enum.
export type CaseKind = 'A' | 'B' | 'C';

export type ChildKind = 'fetus' | 'child';

export type Gender = 'male' | 'female' | 'undecided';

export type RecordPurpose =
  | 'book_making'
  | 'memory_keeping'
  | 'family_share'
  | 'emotion_diary';

// ChildSubmission is the JSON shape POST /onboarding/case expects for
// each entry in `children`. Field presence depends on `kind`:
//
//   - kind: 'fetus' → display_name?, pregnancy_weeks, due_date,
//                     introduction?, photo_tmp_key?
//   - kind: 'child' → display_name, birth_date,
//                     introduction?, photo_tmp_key?
//
// The server enforces these rules; the client should mirror them so the
// UI never assembles an obviously invalid payload.
export type ChildSubmission = {
  kind: ChildKind;
  display_name?: string;
  gender: Gender;
  introduction?: string;
  photo_tmp_key?: string;
  birth_date?: string;
  pregnancy_weeks?: number;
  due_date?: string;
  purposes: RecordPurpose[];
};

export type CaseSubmissionPayload = {
  case: CaseKind;
  children: ChildSubmission[];
};

// ChildView mirrors the per-child JSON the server returns from
// POST /onboarding/case.
export type ChildView = {
  id: string;
  kind: ChildKind;
  display_name: string | null;
  gender: Gender;
  introduction: string | null;
  photo_s3_key: string | null;
  birth_date: string | null;
  pregnancy_weeks: number | null;
  due_date: string | null;
  sort_order: number;
  purposes: RecordPurpose[];
};

export type CaseSubmissionResponse = {
  children: ChildView[];
  user: User;
};

// submitCaseOnboarding posts the final funnel commit. On success, the
// server has stamped onboarded_at and case_kind, inserted the children
// rows, and (best-effort) renamed any photo_tmp_keys to permanent keys.
export async function submitCaseOnboarding(
  payload: CaseSubmissionPayload,
): Promise<CaseSubmissionResponse> {
  // Strip undefined fields so the server's DisallowUnknownFields doesn't
  // reject the payload; JSON.stringify already drops `undefined`, but
  // we copy explicitly so the wire form is auditable in tests.
  const body = {
    case: payload.case,
    children: payload.children.map((c) => trimChild(c)),
  };
  const res = await apiFetch('/onboarding/case', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // body unreadable — surface the status alone
    }
    throw new Error(`submitCaseOnboarding failed: ${res.status}${detail ? ` ${detail}` : ''}`);
  }
  return (await res.json()) as CaseSubmissionResponse;
}

function trimChild(c: ChildSubmission): ChildSubmission {
  const out: ChildSubmission = {
    kind: c.kind,
    gender: c.gender,
    purposes: c.purposes,
  };
  if (c.display_name) out.display_name = c.display_name;
  if (c.introduction) out.introduction = c.introduction;
  if (c.photo_tmp_key) out.photo_tmp_key = c.photo_tmp_key;
  if (c.birth_date) out.birth_date = c.birth_date;
  if (typeof c.pregnancy_weeks === 'number') out.pregnancy_weeks = c.pregnancy_weeks;
  if (c.due_date) out.due_date = c.due_date;
  return out;
}
