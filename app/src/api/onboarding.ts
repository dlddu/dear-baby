// Onboarding case-branching API surface — three calls:
//
//   1. POST /onboarding/children/photo/upload-url → presigned S3 PUT
//      for an onboarding-tmp object. The body's `format` picks the
//      Content-Type the server signs.
//   2. PUT  {upload_url} → the device uploads bytes directly to S3.
//   3. POST /onboarding/case → final submission. The server validates
//      the case shape, copies any onboarding-tmp objects to their
//      permanent layout, and stamps onboarded_at.
//
// The home screen flips from 'onboarding' to 'authenticated' on the
// updated user payload returned by step 3.

import { apiFetch } from './client';
import type {
  ChildGender,
  ChildKind,
  OnboardingCase,
  RecordPurpose,
  SubmitCaseResponse,
} from './types';

// PhotoFormat enumerates the image container formats the server's
// ParseImageFormat will accept. The client picks one from the file
// extension at upload time.
export type PhotoFormat = 'jpeg' | 'png' | 'heic';

// ChildPhotoUploadURL mirrors the backend's
// childPhotoUploadURLResponse. `photo_tmp_key` MUST be passed back
// verbatim inside SubmitCaseRequest — the server validates it against
// its tmp namespace before copying into the permanent layout.
export type ChildPhotoUploadURL = {
  upload_url: string;
  method: string;
  expires_at: string;
  content_type: string;
  max_bytes: number;
  photo_tmp_key: string;
};

export async function requestChildPhotoUploadURL(
  format: PhotoFormat,
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

// uploadChildPhotoToS3 streams the local file to the presigned PUT URL.
// The Content-Type and the size ceiling must match what the server
// presigned, otherwise S3 answers with SignatureDoesNotMatch.
export async function uploadChildPhotoToS3(
  presigned: ChildPhotoUploadURL,
  fileUri: string,
): Promise<void> {
  const body =
    typeof fileUri === 'string' && fileUri.startsWith('file://')
      ? // RN-only shape; harmless on web because we never reach this in dev
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

// SubmitCaseChildInput mirrors the backend ChildInput. Either fetus
// fields (pregnancy_weeks + due_date) OR child fields (display_name +
// birth_date) must be populated, never both — server validation
// rejects the wrong shape with 400.
export type SubmitCaseChildInput = {
  kind: ChildKind;
  display_name?: string | null;
  gender: ChildGender;
  introduction?: string | null;
  birth_date?: string | null;
  pregnancy_weeks?: number | null;
  due_date?: string | null;
  photo_tmp_key?: string | null;
  purposes: RecordPurpose[];
};

export type SubmitCaseRequest = {
  case: OnboardingCase;
  children: SubmitCaseChildInput[];
};

export async function submitCaseOnboarding(
  body: SubmitCaseRequest,
): Promise<SubmitCaseResponse> {
  // Strip undefined/null optional fields so we don't send them as JSON
  // null when the user simply skipped them.
  const payload: SubmitCaseRequest = {
    case: body.case,
    children: body.children.map((c) => stripNullish(c)),
  };
  const res = await apiFetch('/onboarding/case', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = ` ${await res.text()}`;
    } catch {
      // ignore
    }
    throw new Error(`submitCaseOnboarding failed: ${res.status}${detail}`);
  }
  return (await res.json()) as SubmitCaseResponse;
}

function stripNullish(c: SubmitCaseChildInput): SubmitCaseChildInput {
  const out: SubmitCaseChildInput = {
    kind: c.kind,
    gender: c.gender,
    purposes: c.purposes,
  };
  const optional: (keyof SubmitCaseChildInput)[] = [
    'display_name',
    'introduction',
    'birth_date',
    'pregnancy_weeks',
    'due_date',
    'photo_tmp_key',
  ];
  for (const k of optional) {
    const v = c[k];
    if (v !== undefined && v !== null && v !== '') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[k] = v;
    }
  }
  return out;
}
