import type { TaskDeps } from '../../deps.js';
import { resultChannel } from '../../protocol.js';
import type { AIPreviewPayload } from './index.js';

// AI_PREVIEW_TIMEOUT_MS caps the OpenRouter round-trip. Above this we
// surface a 'error' result to the client so the UI can show the retry
// button — tying up the worker slot longer has no upside.
const AI_PREVIEW_TIMEOUT_MS = 15_000;

// SYSTEM_PROMPT mirrors the plan. Keep this in sync with
// docs/engineering/ai-preview-scopes.md when the tone shifts.
const SYSTEM_PROMPT = [
  '임신 중 엄마가 남긴 짧은 기록을 1~2문장의 따뜻한 감성 미리보기로 다듬어줘.',
  '원문의 사실은 바꾸지 마.',
  '경어체 유지.',
  '이모지 1개 허용.',
].join(' ');

export async function handleAIPreview(
  payload: AIPreviewPayload,
  deps: TaskDeps,
): Promise<void> {
  const channel = resultChannel('ai_preview', payload.user_id);
  try {
    const preview = await runEdit(deps, payload.content);
    await deps.backend.saveAIPreview(payload.user_id, preview);
    await deps.redis.publish(
      channel,
      JSON.stringify({ status: 'ok', preview }),
    );
    deps.logger.info(
      { userId: payload.user_id, recordId: payload.record_id },
      'ai_preview generated',
    );
  } catch (err) {
    deps.logger.error(
      { err, userId: payload.user_id },
      'ai_preview failed',
    );
    const message = err instanceof Error ? err.message : 'unknown';
    // DB intentionally not updated on failure — keeps ai_preview null so the
    // sync path (and the retry button) can try again.
    await deps.redis.publish(
      channel,
      JSON.stringify({ status: 'error', error: message }),
    );
  }
}

async function runEdit(deps: TaskDeps, content: string): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AI_PREVIEW_TIMEOUT_MS);
  try {
    const completion = await deps.openrouter.chat.completions.create(
      {
        model: deps.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      },
      { signal: ac.signal },
    );
    const out = completion.choices?.[0]?.message?.content?.trim();
    if (!out) {
      throw new Error('empty completion');
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}
