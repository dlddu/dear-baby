# AI Preview — Stage 2 vs Stage 3 boundaries

The AI editing feature appears twice in the onboarding flow. They share the
spirit ("show the user the value of AI-edited records") but are separate
pipelines with separate data.

## Stage 2: `onboarding.ai_preview`

- **Trigger**: user saves their very first record.
- **Input**: exactly one record (the first).
- **Output shape**: one or two sentences, warm emotional preview.
- **Storage**: `onboarding.ai_preview` column (nullable text) on the
  onboarding row. One value per user, lifetime.
- **Surfacing**: home screen's AiPreviewCard, transitioning
  `teaser → loading → ready`.
- **System prompt**: see `worker/src/tasks/ai-preview/handle.ts`.
- **Model**: configured per environment via `OPENROUTER_MODEL`.

## Stage 3: (not yet built)

- **Trigger**: user has accumulated 3–5 records.
- **Input**: multiple records, aggregated.
- **Output shape**: narrative essay ("3월의 어느 따뜻한 오후에…").
- **Storage**: will be a **separate** table/column. **Does not reuse**
  `onboarding.ai_preview`.
- **Surfacing**: a new Stage 3 screen with book-preview CTA (see
  `docs/design-system/onboarding.md`).

The two outputs have different lengths, different tones, and different
retention semantics (Stage 2 is a one-shot teaser; Stage 3 is a living
draft that updates as more records come in). Keeping them in separate
columns avoids the temptation to overload one field with two meanings.

## Why not reuse `onboarding.ai_preview` for Stage 3?

1. Stage 3 runs on every Nth record, so its value is not a one-time write.
2. Stage 3's narrative contains enough editing that users may want to
   approve / revise it (PRD-001 AC-001-03). That UX needs a wider schema
   (status field, history), which would pollute the onboarding row.
3. Stage 2 is scoped to onboarding and will eventually be dropped from
   `/me`'s flat response once the client no longer needs it on boot.
   Coupling Stage 3 to that cycle would create a needless migration
   dependency.
