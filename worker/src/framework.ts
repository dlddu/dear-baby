import { z } from 'zod';

import type { Envelope } from './protocol.js';
import { QUEUE_KEY } from './protocol.js';
import type { TaskDeps } from './deps.js';

// Task is the abstraction every background unit conforms to. `handle`
// processes one job. `sync` runs at boot to self-heal any jobs that were
// lost because Redis dropped its state — each task consults the DB through
// the backend internal API to see what's still outstanding.
export interface Task<P> {
  type: string;
  schema: z.ZodType<P>;
  handle(payload: P, deps: TaskDeps): Promise<void>;
  sync(deps: TaskDeps): Promise<void>;
}

// Registry accepts tasks and dispatches envelopes to the right handler. It
// doesn't know about Redis — the caller pulls messages and passes them in.
export class TaskRegistry {
  // The erased any here is unavoidable: payload types vary by task. Each
  // entry's schema guards its own handle so the runtime cast is safe.
  private readonly tasks = new Map<string, Task<any>>();

  register<P>(task: Task<P>): void {
    if (this.tasks.has(task.type)) {
      throw new Error(`duplicate task type: ${task.type}`);
    }
    this.tasks.set(task.type, task);
  }

  list(): Task<any>[] {
    return [...this.tasks.values()];
  }

  async dispatch(envelope: Envelope, deps: TaskDeps): Promise<void> {
    const task = this.tasks.get(envelope.type);
    if (!task) {
      deps.logger.warn({ type: envelope.type }, 'unknown task type, dropping');
      return;
    }
    const parsed = task.schema.safeParse(envelope.payload);
    if (!parsed.success) {
      deps.logger.error(
        { type: envelope.type, err: parsed.error.flatten() },
        'payload schema mismatch, dropping',
      );
      return;
    }
    await task.handle(parsed.data, deps);
  }
}

// runWorker blocks the current task until SIGTERM/SIGINT arrives. It first
// runs every registered task's sync() in parallel, then pops jobs from the
// shared queue one at a time.
export async function runWorker(
  registry: TaskRegistry,
  deps: TaskDeps,
): Promise<void> {
  deps.logger.info('starting boot sync');
  await Promise.all(
    registry.list().map(async (t) => {
      try {
        await t.sync(deps);
      } catch (err) {
        deps.logger.error({ err, type: t.type }, 'sync failed');
      }
    }),
  );
  deps.logger.info('boot sync complete');

  let shutdown = false;
  const stop = () => {
    shutdown = true;
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  while (!shutdown) {
    // BRPOP with 5s timeout so shutdown signals are observed without
    // killing a long-running OpenRouter call in flight.
    const popped = await deps.redis.brpop(QUEUE_KEY, 5);
    if (!popped) continue;
    const [, raw] = popped;
    let envelope: Envelope;
    try {
      envelope = JSON.parse(raw) as Envelope;
    } catch (err) {
      deps.logger.error({ err, raw }, 'malformed envelope');
      continue;
    }
    try {
      await registry.dispatch(envelope, deps);
    } catch (err) {
      deps.logger.error({ err, type: envelope.type }, 'dispatch failed');
    }
  }

  deps.logger.info('shutdown requested, exiting');
}
