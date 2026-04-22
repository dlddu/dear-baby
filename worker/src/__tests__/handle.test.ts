import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';

import { handleAIPreview } from '../tasks/ai-preview/handle.js';
import type { TaskDeps, BackendClient } from '../deps.js';
import { resultChannel } from '../protocol.js';

function makeDeps(
  override: Partial<TaskDeps> & {
    completionText?: string;
    completionError?: Error;
    backendError?: Error;
  } = {},
): {
  deps: TaskDeps;
  backend: BackendClient & { saved: { userId: string; preview: string }[] };
  published: { channel: string; message: string }[];
} {
  const published: { channel: string; message: string }[] = [];
  const saved: { userId: string; preview: string }[] = [];
  const backend: BackendClient & typeof saved extends infer _ ? any : never =
    {
      saved,
      async listPendingAIPreviews() {
        return [];
      },
      async saveAIPreview(userId: string, preview: string) {
        if (override.backendError) throw override.backendError;
        saved.push({ userId, preview });
      },
    };
  const openrouter = {
    chat: {
      completions: {
        create: vi.fn(async () => {
          if (override.completionError) throw override.completionError;
          return {
            choices: [
              {
                message: {
                  content: override.completionText ?? '  따뜻한 첫 만남 🌱  ',
                },
              },
            ],
          };
        }),
      },
    },
  } as unknown as TaskDeps['openrouter'];
  const redis = {
    async publish(channel: string, message: string) {
      published.push({ channel, message });
      return 1;
    },
  } as unknown as TaskDeps['redis'];
  const deps: TaskDeps = {
    redis,
    openrouter,
    backend,
    logger: pino({ level: 'silent' }),
    model: 'anthropic/claude-haiku',
    ...override,
  };
  return { deps, backend, published };
}

describe('handleAIPreview', () => {
  it('saves preview and publishes ok on success', async () => {
    const { deps, backend, published } = makeDeps();
    await handleAIPreview(
      { user_id: 'u1', record_id: 'r1', content: '오늘 너를 처음 느꼈어' },
      deps,
    );
    expect(backend.saved).toEqual([{ userId: 'u1', preview: '따뜻한 첫 만남 🌱' }]);
    expect(published).toHaveLength(1);
    expect(published[0].channel).toBe(resultChannel('ai_preview', 'u1'));
    expect(JSON.parse(published[0].message)).toEqual({
      status: 'ok',
      preview: '따뜻한 첫 만남 🌱',
    });
  });

  it('publishes error and does not call saveAIPreview when OpenRouter fails', async () => {
    const { deps, backend, published } = makeDeps({
      completionError: new Error('rate limited'),
    });
    await handleAIPreview(
      { user_id: 'u1', record_id: 'r1', content: 'x' },
      deps,
    );
    expect(backend.saved).toHaveLength(0);
    expect(published).toHaveLength(1);
    expect(JSON.parse(published[0].message)).toMatchObject({
      status: 'error',
    });
  });

  it('publishes error when completion is empty', async () => {
    const { deps, backend, published } = makeDeps({ completionText: '' });
    await handleAIPreview(
      { user_id: 'u2', record_id: 'r1', content: 'x' },
      deps,
    );
    expect(backend.saved).toHaveLength(0);
    expect(JSON.parse(published[0].message)).toMatchObject({ status: 'error' });
  });
});
