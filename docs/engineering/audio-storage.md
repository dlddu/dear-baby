# Records audio storage

This document covers how voice records are stored: where transcripts live, where audio blobs live, and how the device, the backend, and S3 cooperate without the backend ever touching the audio bytes.

## Two artifacts, decoupled

A voice record produces two artifacts. They live separately on purpose.

| Artifact | Where it lives | Required? |
|---|---|---|
| Transcript | `records.content` (server) | Yes — the row exists only when transcript is committed. |
| Audio blob | S3 object at `users/{user_id}/records/{record_id}.m4a` (under the configured prefix) | No — `records.audio_s3_key` may stay null forever. |

The transcript is the authoritative diary entry. The audio is a souvenir the user can keep, upload later, or delete entirely. Two records with identical transcripts are functionally identical even if one has audio and the other doesn't.

## Why the backend doesn't proxy audio

The backend issues short-lived presigned PUT URLs and lets the device upload directly to S3. Reasons:

- The Go process never holds 25 MiB blobs in memory or on its tiny PVC.
- A failed upload is a single client-side retry, not a server-side transaction rollback.
- Bandwidth scales with S3, not with our pod count.

The trade-off is that the backend can't reject corrupt audio mid-stream. We catch this on PATCH by HEAD-ing the object before flipping `audio_s3_key` to non-null — if S3 doesn't have it, we don't claim we do.

## End-to-end flow

```
[device]                                        [backend]              [S3]
  │
  ├── POST /records {content, source: "voice"} ─► creates row, audio_s3_key = NULL
  │   ◄──────────────────── 201 {record, user} ──┤
  │                                              │
  ├── POST /records/{id}/audio/upload-url ──────►│
  │   ◄─── 200 {upload_url, audio_s3_key, ttl} ──┤
  │                                              │
  ├── PUT {upload_url} (Content-Type: audio/mp4) ────────────────────────►│
  │   ◄────────────────────────────────────────────────── 200 ─────────────┤
  │                                              │                        │
  ├── PATCH /records/{id} {audio_s3_key} ───────►│                        │
  │                                              │── HEAD object ────────►│
  │                                              │   ◄──── 200 ────────────┤
  │   ◄───────── 200 {record} ────────────────────┤
```

If the user picks "save without audio", steps 2–4 are skipped and the row simply stays with `audio_s3_key = NULL`. That row may stay text-only forever, or the user may attach audio later via the local drafts screen.

## Credentials: AssumeRole

The backend never holds long-lived AWS credentials in plaintext. Instead it assumes a single role at startup, scoped to the records-audio key prefix.

| Var | Required | Example | Notes |
|---|---|---|---|
| `AWS_REGION` | yes | `ap-northeast-2` | Bucket region; STS endpoint inferred. |
| `AWS_ASSUME_ROLE_ARN` | optional | `arn:aws:iam::123456789012:role/dear-baby-records-writer` | When set, ambient creds → AssumeRole → assumed creds. When unset, ambient creds are used directly (local dev with static keys). |
| `AWS_S3_BUCKET` | yes | `dear-baby-records-prod` | Different per environment. |
| `AWS_S3_KEY_PREFIX` | optional | `prod/`, `dev/alice/`, `""` | Trailing slash auto-normalised. Empty means objects live at the bucket root. |

`AWS_REGION` or `AWS_S3_BUCKET` missing → the records-audio routes are not mounted, but text records and `/health` keep working. This is the smoke-test / minimal-deploy path.

The IAM role's policy should restrict to:

```
arn:aws:s3:::${AWS_S3_BUCKET}/${AWS_S3_KEY_PREFIX}users/*
```

with permission for `s3:PutObject`, `s3:GetObject`, and `s3:HeadObject`. The backend never lists, never deletes — those operations go through ops tooling.

## Key invariants

These rules constrain the implementation. Breaking any of them is a bug.

1. **`records.audio_s3_key` may be `NULL` forever.** It is not a workflow state — it's a presence flag. Don't add a "pending" / "uploaded" / "failed" enum.
2. **The client never assembles the S3 key.** The backend hands it back inside the upload-url response, and the client echoes the same string in PATCH. Anything else is rejected by `IsValidRecordAudioKey`.
3. **Transcript is committed before audio.** The order matters: a `POST /records` always returns a `record_id`, and any audio attaches to that existing row. There is no flow where the audio commits first and the transcript follows.
4. **PATCH `audio_s3_key` is one-way.** Null → non-null exactly once. To "remove" audio, the user keeps the row but deletes the local copy; the row stays text-only.
5. **HEAD verification is non-negotiable.** The server never sets `audio_s3_key` to a key the client merely claims exists.

## Local development

`docker-compose.yml` does not currently bring up an S3 mock. Two options when you need to exercise the audio path locally:

- LocalStack: set `AWS_REGION=us-east-1`, `AWS_S3_BUCKET=dear-baby-local`, leave `AWS_ASSUME_ROLE_ARN` empty, and point the AWS SDK at LocalStack via `AWS_ENDPOINT_URL_S3`.
- A dev-only S3 bucket on a personal AWS account: same vars, plus a static `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` pair scoped to a sandbox role.

For CI integration tests today, the audio routes are simply not enabled (no env vars set) and the flow stops after `POST /records` — sufficient to verify the transcript / AI-preview path. A future ENG note will cover wiring LocalStack into `integration.yml` once the device-side flow is stable.
