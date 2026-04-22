import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';

import { syncAIPreviews } from '../tasks/ai-preview/sync.js';
import type { TaskDeps, BackendClient, PendingAIPreview } from '../deps.js';

describe('syncAIPreviews', () => {
  it('processes every pending user on boot', async () => {
    const pending: PendingAIPreview[] = [
      { user_id: 'u1', record_id: 'r1', content: '첫 번째' },
      { user_id: 'u2', record_id: 'r2', content: '두 번째' },
    ];
    const saved: { userId: string; preview: string }[] = [];
    const backend: BackendClient = {
      async listPendingAIPreviews() {
        return pending;
      },
      async saveAIPreview(userId, preview) {
        saved.push({ userId, preview });
      },
    };
    const publishes: string[] = [];
    const openrouter = {
      chat: {
        completions: {
          create: vi.fn(async (req: any) => ({
            choices: [{ message: { content: `edited(${req.messages[1].content})` } }],
          })),
        },
      },
    } as unknown as TaskDeps['openrouter'];
    const redis = {
      async publish(channel: string) {
        publishes.push(channel);
        return 1;
      },
    } as unknown as TaskDeps['redis'];
    const deps: TaskDeps = {
      redis,
      openrouter,
      backend,
      logger: pino({ level: 'silent' }),
      model: 'claude-haiku',
    };

    await syncAIPreviews(deps);

    expect(saved).toEqual([
      { userId: 'u1', preview: 'edited(첫 번째)' },
      { userId: 'u2', preview: 'edited(두 번째)' },
    ]);
    expect(publishes).toContain('tasks:result:ai_preview:u1');
    expect(publishes).toContain('tasks:result:ai_preview:u2');
  });

  it('swallows per-user failures and continues', async () => {
    const backend: BackendClient = {
      async listPendingAIPreviews() {
        return [
          { user_id: 'u1', record_id: 'r1', content: 'a' },
          { user_id: 'u2', record_id: 'r2', content: 'b' },
        ];
      },
      saveAIPreview: vi
        .fn()
        .mockImplementationOnce(async () => {
          throw new Error('db down');
        })
        .mockResolvedValueOnce(undefined),
    };
    const openrouter = {
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [{ message: { content: 'ok' } }],
          })),
        },
      },
    } as unknown as TaskDeps['openrouter'];
    const redis = {
      publish: vi.fn(async () => 1),
    } as unknown as TaskDeps['redis'];

    const deps: TaskDeps = {
      redis,
      openrouter,
      backend,
      logger: pino({ level: 'silent' }),
      model: 'x',
    };

    // Should not throw despite u1 failing.
    await expect(syncAIPreviews(deps)).resolves.toBeUndefined();
    // u2 must still have been processed.
    expect((backend.saveAIPreview as any).mock.calls.length).toBe(2);
  });
});
