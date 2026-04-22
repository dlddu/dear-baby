import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';
import { z } from 'zod';

import { TaskRegistry } from '../framework.js';
import type { Task } from '../framework.js';
import type { TaskDeps } from '../deps.js';

function makeDeps(): TaskDeps {
  return {
    redis: {} as TaskDeps['redis'],
    openrouter: {} as TaskDeps['openrouter'],
    backend: {
      async listPendingAIPreviews() {
        return [];
      },
      async saveAIPreview() {},
    },
    logger: pino({ level: 'silent' }),
    model: 'x',
  };
}

describe('TaskRegistry', () => {
  it('routes dispatch by task type', async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    const task: Task<{ n: number }> = {
      type: 'unit',
      schema: z.object({ n: z.number() }),
      handle,
      sync: async () => {},
    };
    const reg = new TaskRegistry();
    reg.register(task);
    await reg.dispatch(
      {
        type: 'unit',
        job_id: 'j1',
        issued_at: new Date().toISOString(),
        v: 1,
        payload: { n: 42 },
      },
      makeDeps(),
    );
    expect(handle).toHaveBeenCalledWith({ n: 42 }, expect.anything());
  });

  it('drops envelopes with schema mismatches without calling handle', async () => {
    const handle = vi.fn();
    const task: Task<{ n: number }> = {
      type: 'unit',
      schema: z.object({ n: z.number() }),
      handle,
      sync: async () => {},
    };
    const reg = new TaskRegistry();
    reg.register(task);
    await reg.dispatch(
      {
        type: 'unit',
        job_id: 'j1',
        issued_at: new Date().toISOString(),
        v: 1,
        payload: { n: 'not-a-number' },
      },
      makeDeps(),
    );
    expect(handle).not.toHaveBeenCalled();
  });

  it('drops envelopes with unknown types', async () => {
    const reg = new TaskRegistry();
    await expect(
      reg.dispatch(
        {
          type: 'nope',
          job_id: 'j1',
          issued_at: new Date().toISOString(),
          v: 1,
          payload: {},
        },
        makeDeps(),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects duplicate task registration', () => {
    const reg = new TaskRegistry();
    const t: Task<unknown> = {
      type: 'dup',
      schema: z.any(),
      handle: async () => {},
      sync: async () => {},
    };
    reg.register(t);
    expect(() => reg.register(t)).toThrow(/duplicate/);
  });
});
