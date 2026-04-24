import { z } from 'zod';

// QUEUE_KEY is the single Redis LIST that the backend pushes jobs onto.
// The framework BRPOPs on this key, dispatches by `type`, and publishes
// results on task-specific pub/sub channels.
export const QUEUE_KEY = 'tasks:queue';

// resultChannel returns the pub/sub channel for a task's per-user result
// stream. The backend's SSE hub subscribes to `tasks:result:*` and
// fan-outs to connected clients.
export function resultChannel(taskType: string, userID: string): string {
  return `tasks:result:${taskType}:${userID}`;
}

// envelopeSchema validates the raw JSON pulled off the queue before any
// task-specific parsing. `v` is the protocol version so old workers can
// gracefully reject future payloads if we add fields.
export const envelopeSchema = z.object({
  type: z.string().min(1),
  payload: z.unknown(),
  job_id: z.string().min(1),
  issued_at: z.string().min(1),
  v: z.literal(1),
});

export type Envelope = z.infer<typeof envelopeSchema>;

// Result shapes published on `tasks:result:<type>:<userID>`. Tasks stay
// uniform: `{status: 'ok'|'error', ...}` so the SSE hub can fan out
// without special-casing each task.
export const resultOkSchema = z.object({
  status: z.literal('ok'),
  preview: z.string().optional(),
});

export const resultErrorSchema = z.object({
  status: z.literal('error'),
  error: z.string(),
});

export const resultSchema = z.union([resultOkSchema, resultErrorSchema]);

export type Result = z.infer<typeof resultSchema>;
