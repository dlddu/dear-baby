import type { TaskDeps } from '../../deps';
import { resultChannel } from '../../protocol';
import { errMessage } from '../../framework';

import type { AIPreviewPayload } from './index';

// SYSTEM_PROMPT is the single tuning knob for the Stage 2 preview tone.
// Keep it short and stable — this text is not user-facing, so we don't
// need translation or variants. The user message will be framed with an
// explicit "원본 기록" delimiter (see buildUserMessage) so weak free-tier
// models on openrouter/free recognize the content as the record to
// polish rather than a conversation opener.
export const SYSTEM_PROMPT =
  '임신 중 엄마가 남긴 짧은 기록을 1~2문장의 따뜻한 감성 미리보기로 다듬어줘. 사용자 메시지에 담긴 원본 기록을 반드시 다듬어서 답변으로 출력해. 질문하거나 추가 입력을 요구하지 마. 원문의 사실은 바꾸지 마. 경어체 유지. 이모지 1개 허용.';

// buildUserMessage wraps the raw record in an explicit delimiter so the
// model always sees "here is the record, polish it" rather than just a
// bare utterance. Weak free-tier models otherwise treat a one-liner
// record as an opening chat turn and reply "please enter the record".
export function buildUserMessage(content: string): string {
  return `다음 원본 기록을 다듬어서 미리보기만 출력해 주세요.\n\n<원본 기록>\n${content}\n</원본 기록>`;
}

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
        { role: 'user', content: buildUserMessage(content) },
      ],
      // Cap output tokens so a misbehaving model can't run the meter. A
      // 1–2 sentence preview is well under 200 tokens in Korean.
      max_tokens: 300,
    },
    { timeout: HANDLE_TIMEOUT_MS },
  );
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

  // Guard against the sync() path, which calls handle() directly and
  // therefore bypasses the registry's Zod parse. An empty record would
  // make the LLM respond "please enter the original record" — exactly
  // the failure mode the user reported.
  const trimmed = content.trim();
  if (trimmed === '') {
    log.error('empty record content — refusing to call LLM');
    try {
      await deps.redis.publish(
        resultChannel('ai_preview', user_id),
        JSON.stringify({ status: 'error', error: 'empty record content' }),
      );
    } catch (pubErr) {
      log.error({ err: errMessage(pubErr) }, 'failed to publish error result');
    }
    return;
  }

  log.debug({ model: deps.model, contentLength: trimmed.length }, 'handle start');
  const started = Date.now();

  try {
    const preview = await generatePreview(deps, trimmed);
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
