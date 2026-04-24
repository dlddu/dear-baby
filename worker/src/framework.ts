import type { Logger } from 'pino';
import type { z } from 'zod';

import type { TaskDeps } from './deps';
import { QUEUE_KEY, envelopeSchema } from './protocol';

// Task is the unit of work the framework dispatches. Each task declares:
// - `type`: discriminator that matches the envelope's `type`.
// - `schema`: runtime validator for the payload.
// - `handle`: one-shot dispatch.
//
// Boot-time recovery is the backend's responsibility: it re-enqueues any
// work Redis may have dropped before the worker comes online, so tasks
// stay pure compute.
export interface Task<P> {
  readonly type: string;
  readonly schema: z.ZodType<P>;
  handle(payload: P, deps: TaskDeps): Promise<void>;
}

// TaskRegistry tracks registered tasks and dispatches raw envelopes to
// them. Decoupled from the runner so tests can exercise dispatch without
// spinning up a real Redis loop.
export class TaskRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly tasks = new Map<string, Task<any>>();

  register<P>(task: Task<P>): void {
    if (this.tasks.has(task.type)) {
      throw new Error(`duplicate task type: ${task.type}`);
    }
    this.tasks.set(task.type, task);
  }

  all(): Task<unknown>[] {
    return Array.from(this.tasks.values());
  }

  async dispatch(raw: unknown, deps: TaskDeps): Promise<void> {
    const env = envelopeSchema.parse(raw);
    const task = this.tasks.get(env.type);
    if (!task) {
      throw new Error(`unknown task type: ${env.type}`);
    }
    const payload = task.schema.parse(env.payload);
    await task.handle(payload, deps);
  }
}

// runWorker is the main event loop. It BRPOPs forever, dispatching
// envelopes until `stop()` is called. Recovery of messages lost across
// restarts happens on the backend side, not here.
export interface WorkerOptions {
  registry: TaskRegistry;
  deps: TaskDeps;
  logger: Logger;
  // blockTimeoutSec controls how long BRPOP blocks before returning nil.
  // Non-zero so the loop can check its stop flag periodically without
  // long sleeps; 5s keeps spin cost negligible while still being
  // responsive to SIGTERM.
  blockTimeoutSec?: number;
}

export interface WorkerHandle {
  stop(): Promise<void>;
  wait(): Promise<void>;
}

export function runWorker(opts: WorkerOptions): WorkerHandle {
  const { registry, deps, logger, blockTimeoutSec = 5 } = opts;
  let stopping = false;
  let currentLoop: Promise<void> | null = null;

  const consume = async () => {
    logger.info({ queue: QUEUE_KEY, blockTimeoutSec }, 'entering consume loop');
    while (!stopping) {
      let popped: [string, string] | null = null;
      try {
        popped = await deps.redis.brpop(QUEUE_KEY, blockTimeoutSec);
      } catch (err) {
        logger.error({ err: errMessage(err) }, 'brpop failed');
        // Back off briefly before retrying so a Redis outage does not
        // spin the CPU.
        await sleep(1000);
        continue;
      }
      if (!popped) continue;
      const raw = popped[1];
      logger.debug({ rawLength: raw.length }, 'brpop returned task');
      let envJSON: unknown;
      try {
        envJSON = JSON.parse(raw);
      } catch (err) {
        logger.error({ raw, err: errMessage(err) }, 'invalid JSON on queue');
        continue;
      }
      try {
        await registry.dispatch(envJSON, deps);
        logger.debug('task dispatch finished');
      } catch (err) {
        logger.error({ err: errMessage(err), raw }, 'dispatch failed');
      }
    }
  };

  currentLoop = consume();

  return {
    async stop() {
      stopping = true;
    },
    async wait() {
      if (currentLoop) await currentLoop;
    },
  };
}

export function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
