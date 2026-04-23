import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';

import { handle } from '../tasks/ai-preview/handle';
import { resultChannel } from '../protocol';

// buildDeps stands up a minimal TaskDeps with every external collaborator
// replaced by a controllable mock.
function buildDeps(options: {
  completionResponse?: unknown;
  completionError?: unknown;
  saveError?: unknown;
  publishError?: unknown;
}) {
  const publishes: Array<{ channel: string; message: string }> = [];
  const saves: Array<{ userID: string; preview: string }> = [];

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

  const backend = {
    listPendingAIPreviews: vi.fn(),
    saveAIPreview: vi.fn().mockImplementation(async (userID: string, preview: string) => {
      if (options.saveError) throw options.saveError;
      saves.push({ userID, preview });
    }),
  };

  const logger = pino({ level: 'silent' });

  return {
    deps: { redis, openrouter, model: 'test-model', backend, logger },
    publishes,
    saves,
    mocks: { openrouter, redis, backend },
  };
}

describe('ai-preview handle', () => {
  it('generates, saves, and publishes ok', async () => {
    const { deps, publishes, saves, mocks } = buildDeps({});
    await handle(
      { user_id: 'u1', record_id: 'r1', content: '오늘 너의 움직임을 처음 느꼈어.' },
      deps,
    );

    expect(saves).toEqual([{ userID: 'u1', preview: '정리된 미리보기 ✨' }]);
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
    // The user message wraps the raw record in an explicit 원본 기록
    // delimiter so weak free-tier models see "polish this" instead of an
    // open-ended conversation.
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toContain('움직임');
    expect(args.messages[1].content).toContain('<원본 기록>');
    expect(args.messages[1].content).toContain('</원본 기록>');
  });

  it('refuses to call the LLM when content is empty (sync bypass guard)', async () => {
    const { deps, publishes, mocks } = buildDeps({});
    await handle(
      { user_id: 'u4', record_id: 'r4', content: '   ' },
      deps,
    );

    const create = mocks.openrouter.chat.completions.create as ReturnType<
      typeof vi.fn
    >;
    expect(create).not.toHaveBeenCalled();
    expect(publishes).toHaveLength(1);
    const payload = JSON.parse(publishes[0].message);
    expect(payload.status).toBe('error');
    expect(payload.error).toContain('empty record');
  });

  it('publishes error + skips saveAIPreview on OpenRouter failure', async () => {
    const { deps, publishes, saves, mocks } = buildDeps({
      completionError: new Error('openrouter down'),
    });
    await handle(
      { user_id: 'u9', record_id: 'r9', content: 'x' },
      deps,
    );

    expect(saves).toHaveLength(0);
    expect(
      (mocks.backend.saveAIPreview as ReturnType<typeof vi.fn>).mock.calls,
    ).toHaveLength(0);
    expect(publishes).toHaveLength(1);
    const payload = JSON.parse(publishes[0].message);
    expect(payload.status).toBe('error');
    expect(payload.error).toContain('openrouter down');
  });

  it('publishes error on empty model output', async () => {
    const { deps, publishes } = buildDeps({
      completionResponse: { choices: [{ message: { content: '   ' } }] },
    });
    await handle(
      { user_id: 'u2', record_id: 'r2', content: 'x' },
      deps,
    );
    const payload = JSON.parse(publishes[0].message);
    expect(payload.status).toBe('error');
    expect(payload.error).toContain('empty preview');
  });

  it('survives a publish failure without throwing', async () => {
    const { deps } = buildDeps({
      completionError: new Error('openrouter down'),
      publishError: new Error('redis unavailable'),
    });
    // Should not reject — the error path swallows publish failures after
    // logging so the worker can take the next job.
    await expect(
      handle({ user_id: 'u3', record_id: 'r3', content: 'x' }, deps),
    ).resolves.toBeUndefined();
  });
});
