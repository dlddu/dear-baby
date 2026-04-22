# AI Preview Scopes

This document draws the line between the **home-screen AI preview** (active, Stage 2) and the **book-length AI narrative** (planned, Stage 3). They share the word "AI" in the spec but are different features with different storage, different model prompts, and different failure tolerances.

## Stage 2 — `onboarding.ai_preview`

**Trigger**: user saves their first record.

**Input**: exactly one record — the user's oldest entry, typically 1–3 sentences of raw text.

**Output**: a 1–2 sentence emotional preview. Korean, gentle tone, at most one emoji.

**Storage**: `onboarding.ai_preview` column (single text field, nullable).

**Retries**: idempotent — retrying overwrites the same column. The client exposes a "다시 시도" button on failure.

**Lifetime**: one-shot per user. Once the row holds a non-null value, the column is effectively frozen for the rest of Stage 2. There is no background job that re-runs to refresh the text.

**Purpose**: Stage 2's "가치 선경험" — before the user commits to repeated journaling, show them what a polished result looks like. Low stakes, one call, cheap.

## Stage 3 — book-length AI narrative (planned, not yet built)

**Trigger**: user accumulates N records (spec currently says 3–5).

**Input**: all of the user's records, joined and ordered chronologically.

**Output**: a multi-paragraph narrative — the "우리 아기 이야기" shown on the Stage 3 screen.

**Storage**: a new table (TBD) keyed by `(user_id, version)` so we can keep every generated narrative and let users pick between them.

**Retries**: every run produces a new version. Users may re-run explicitly when they add records.

**Lifetime**: many. Expected to run once every few days as the record count grows.

**Purpose**: Stage 3's "가치 전환" — the output becomes the physical-book preview, so it has to scale with the record corpus.

## What Stage 3 will NOT do

- **Reuse `onboarding.ai_preview`**. Keeping the preview on the onboarding table makes the boundary explicit: if we wanted Stage 3 to live there, we'd eventually need to version it and the onboarding table is the wrong home for that.
- **Re-render Stage 2**'s preview from the Stage 3 narrative. The Stage 2 copy is a first-record teaser; the Stage 3 narrative is built from all records. Keeping them separate also means UI can show both without a race.

## Stage 2 implementation references

- Column: `backend/internal/migrations/0005_onboarding_move.up.sql` (`ai_preview`).
- Task: `worker/src/tasks/ai-preview/`.
- Trigger path: client observes `user.first_record_at` flipping from null → set in `app/app/(tabs)/index.tsx`, posts `/onboarding/ai-preview`, subscribes to `/onboarding/ai-preview/events`.
- System prompt: `worker/src/tasks/ai-preview/handle.ts` (`SYSTEM_PROMPT`).
