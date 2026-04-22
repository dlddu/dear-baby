import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';

import { sync } from '../tasks/ai-preview/sync';

function buildDeps(pending: Array<{ user_id: string; record_id: string; content: string }>) {
  const saves: Array<{ userID: string; preview: string }> = [];
  const publishes: Array<{ channel: string; message: string }> = [];

  const openrouter = {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => ({
          choices: [{ message: { content: 'edited preview' } }],
        })),
      },
    },
  } as unknown as import('openai').default;

  const redis = {
    publish: vi.fn().mockImplementation(async (channel: string, message: string) => {
      publishes.push({ channel, message });
      return 1;
    }),
  } as unknown as import('ioredis').default;

  const backend = {
    listPendingAIPreviews: vi.fn().mockImplementation(async () => pending),
    saveAIPreview: vi.fn().mockImplementation(async (userID: string, preview: string) => {
      saves.push({ userID, preview });
    }),
  };

  const logger = pino({ level: 'silent' });

  return {
    deps: { redis, openrouter, model: 'm', backend, logger },
    saves,
    publishes,
  };
}

describe('ai-preview sync', () => {
  it('replays every pending item via handle', async () => {
    const { deps, saves, publishes } = buildDeps([
      { user_id: 'u1', record_id: 'r1', content: 'a' },
      { user_id: 'u2', record_id: 'r2', content: 'b' },
    ]);

    await sync(deps);

    expect(saves).toHaveLength(2);
    expect(saves[0].userID).toBe('u1');
    expect(saves[1].userID).toBe('u2');
    expect(publishes).toHaveLength(2);
  });

  it('no-ops when no pending entries', async () => {
    const { deps, saves } = buildDeps([]);
    await sync(deps);
    expect(saves).toHaveLength(0);
  });

  it('swallows listPendingAIPreviews failure without throwing', async () => {
    const { deps } = buildDeps([]);
    (deps.backend.listPendingAIPreviews as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      throw new Error('backend down');
    });
    await expect(sync(deps)).resolves.toBeUndefined();
  });
});
