import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';

import { handle } from '../tasks/ai-preview/handle';
import { resultChannel } from '../protocol';

// buildDeps stands up a minimal TaskDeps with every external collaborator
// replaced by a controllable mock. The worker no longer talks to the
// backend directly — it only calls OpenRouter and publishes on Redis.
function buildDeps(options: {
  completionResponse?: unknown;
  completionError?: unknown;
  publishError?: unknown;
}) {
  const publishes: Array<{ channel: string; message: string }> = [];

  const openrouter = {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => {
          if (options.completionError) throw options.completionError;
          return (
            options.completionResponse ?? {
              choices: [{ message: { content: '정리된 미리보기 ✨' } }],
            }
          );
        }),
      },
    },
  } as unknown as import('openai').default;

  const redis = {
    publish: vi.fn().mockImplementation(async (channel: string, message: string) => {
      if (options.publishError) throw options.publishError;
      publishes.push({ channel, message });
      return 1;
    }),
  } as unknown as import('ioredis').default;

  const logger = pino({ level: 'silent' });

  return {
    deps: { redis, openrouter, model: 'test-model', logger, tracing: null },
    publishes,
    mocks: { openrouter, redis },
  };
}

describe('ai-preview handle', () => {
  it('generates and publishes ok', async () => {
    const { deps, publishes, mocks } = buildDeps({});
    await handle(
      { user_id: 'u1', record_id: 'r1', content: '오늘 너의 움직임을 처음 느꼈어.', attempt: 1 },
      deps,
    );

    expect(publishes).toHaveLength(1);
    expect(publishes[0].channel).toBe(resultChannel('ai_preview', 'u1'));
    const payload = JSON.parse(publishes[0].message);
    expect(payload.status).toBe('ok');
    expect(payload.preview).toBe('정리된 미리보기 ✨');

    const create = mocks.openrouter.chat.completions.create as ReturnType<
      typeof vi.fn
    >;
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0][0];
    expect(args.model).toBe('test-model');
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[1].content).toContain('움직임');
  });

  it('publishes error with attempt echoed on OpenRouter failure', async () => {
    const { deps, publishes } = buildDeps({
      completionError: new Error('openrouter down'),
    });
    await handle(
      { user_id: 'u9', record_id: 'r9', content: 'x', attempt: 2 },
      deps,
    );

    expect(publishes).toHaveLength(1);
    const payload = JSON.parse(publishes[0].message);
    expect(payload.status).toBe('error');
    expect(payload.error).toContain('openrouter down');
    // Backend retry policy reads this to decide whether to re-enqueue.
    expect(payload.attempt).toBe(2);
  });

  it('publishes error on empty model output', async () => {
    const { deps, publishes } = buildDeps({
      completionResponse: { choices: [{ message: { content: '   ' } }] },
    });
    await handle(
      { user_id: 'u2', record_id: 'r2', content: 'x', attempt: 1 },
      deps,
    );
    const payload = JSON.parse(publishes[0].message);
    expect(payload.status).toBe('error');
    expect(payload.error).toContain('empty preview');
    expect(payload.attempt).toBe(1);
  });

  it('survives a publish failure without throwing', async () => {
    const { deps } = buildDeps({
      completionError: new Error('openrouter down'),
      publishError: new Error('redis unavailable'),
    });
    // Should not reject — the error path swallows publish failures after
    // logging so the worker can take the next job.
    await expect(
      handle({ user_id: 'u3', record_id: 'r3', content: 'x', attempt: 1 }, deps),
    ).resolves.toBeUndefined();
  });
});
