import type { TaskDeps } from '../../deps';
import { flushLangfuse } from '../../openrouter';
import { resultChannel } from '../../protocol';
import { errMessage } from '../../framework';

import type { AIPreviewPayload } from './index';

// SYSTEM_PROMPT is the single tuning knob for the Stage 2 preview tone.
// Keep it short and stable — this text is not user-facing, so we don't
// need translation or variants.
export const SYSTEM_PROMPT =
  '임신 중 엄마가 남긴 짧은 기록을 1~2문장의 따뜻한 감성 미리보기로 다듬어줘. 원문의 사실은 바꾸지 마. 경어체 유지. 이모지 1개 허용.';

// HANDLE_TIMEOUT_MS caps the OpenRouter call so one slow model doesn't
// stall the worker indefinitely. 15s matches the SSE client's wait
// tolerance — anything longer on the server side would exceed the E2E
// timeout anyway.
export const HANDLE_TIMEOUT_MS = 15_000;

// generatePreview isolates the LLM call so tests can mock it directly
// without setting up OpenAI SDK internals.
export async function generatePreview(
  deps: TaskDeps,
  content: string,
): Promise<string> {
  const completion = await deps.openrouter.chat.completions.create(
    {
      model: deps.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      // Cap output tokens so a misbehaving model can't run the meter. A
      // 1–2 sentence preview is well under 200 tokens in Korean.
      max_tokens: 300,
    },
    { timeout: HANDLE_TIMEOUT_MS },
  );
  // Await the Langfuse POST inline so CI / short-lived pods don't lose
  // the trace by dying before the 10s flush timer fires. No-op when the
  // wrapper is inactive (missing keys) or when deps.openrouter is a
  // plain test mock.
  await flushLangfuse(deps.openrouter);
  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('empty preview from model');
  }
  return text;
}

export async function handle(
  payload: AIPreviewPayload,
  deps: TaskDeps,
): Promise<void> {
  const { user_id, content } = payload;
  const log = deps.logger.child({ task: 'ai_preview', user_id });

  log.debug({ model: deps.model, contentLength: content.length }, 'handle start');
  const started = Date.now();

  try {
    const preview = await generatePreview(deps, content);
    log.debug(
      { elapsedMs: Date.now() - started, previewLength: preview.length },
      'openrouter returned',
    );
    await deps.backend.saveAIPreview(user_id, preview);
    log.debug('saved preview via internal API');
    await deps.redis.publish(
      resultChannel('ai_preview', user_id),
      JSON.stringify({ status: 'ok', preview }),
    );
    log.info({ preview, elapsedMs: Date.now() - started }, 'preview ready');
  } catch (err) {
    const msg = errMessage(err);
    log.error({ err: msg }, 'preview generation failed');
    // Do NOT write to the DB on failure — leaving ai_preview null keeps
    // the next sync() + client retry viable.
    try {
      await deps.redis.publish(
        resultChannel('ai_preview', user_id),
        JSON.stringify({ status: 'error', error: msg }),
      );
    } catch (pubErr) {
      log.error({ err: errMessage(pubErr) }, 'failed to publish error result');
    }
  }
}
