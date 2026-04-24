import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';
import { z } from 'zod';

import { TaskRegistry } from '../framework';
import type { Task } from '../framework';
import type { TaskDeps } from '../deps';

function buildDeps(): TaskDeps {
  const logger = pino({ level: 'silent' });
  return {
    redis: {} as TaskDeps['redis'],
    openrouter: {} as TaskDeps['openrouter'],
    model: 'm',
    logger,
    tracing: null,
  };
}

describe('TaskRegistry', () => {
  it('dispatches to the task matching envelope.type', async () => {
    const registry = new TaskRegistry();
    const handle = vi.fn();
    const task: Task<{ foo: string }> = {
      type: 't',
      schema: z.object({ foo: z.string() }),
      handle,
    };
    registry.register(task);

    await registry.dispatch(
      { type: 't', payload: { foo: 'bar' }, job_id: 'j1', issued_at: 'now', v: 1 },
      buildDeps(),
    );

    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls[0][0]).toEqual({ foo: 'bar' });
  });

  it('rejects unknown task types', async () => {
    const registry = new TaskRegistry();
    await expect(
      registry.dispatch(
        { type: 'mystery', payload: {}, job_id: 'j', issued_at: 'now', v: 1 },
        buildDeps(),
      ),
    ).rejects.toThrow(/unknown task/);
  });

  it('rejects invalid payloads without calling handle', async () => {
    const registry = new TaskRegistry();
    const handle = vi.fn();
    registry.register({
      type: 't',
      schema: z.object({ foo: z.string() }),
      handle,
    });

    await expect(
      registry.dispatch(
        { type: 't', payload: { foo: 123 }, job_id: 'j', issued_at: 'now', v: 1 },
        buildDeps(),
      ),
    ).rejects.toThrow();
    expect(handle).not.toHaveBeenCalled();
  });

  it('refuses duplicate registration', () => {
    const registry = new TaskRegistry();
    registry.register({
      type: 't',
      schema: z.object({}),
      handle: vi.fn(),
    });
    expect(() =>
      registry.register({
        type: 't',
        schema: z.object({}),
        handle: vi.fn(),
      }),
    ).toThrow(/duplicate/);
  });
});
