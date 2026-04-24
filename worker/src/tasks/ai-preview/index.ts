import { z } from 'zod';

import type { Task } from '../../framework';
import { handle } from './handle';

export const aiPreviewPayloadSchema = z.object({
  user_id: z.string().min(1),
  record_id: z.string().min(1),
  content: z.string().min(1),
  // attempt is echoed back in the result so the backend can decide
  // whether to schedule another retry or surface a final error. Default
  // 1 keeps the wire compatible with older producers that never set it.
  attempt: z.number().int().min(1).default(1),
});

export type AIPreviewPayload = z.infer<typeof aiPreviewPayloadSchema>;

// The ai_preview task reads the user's first record, asks an LLM to
// polish it into a short emotional preview, and publishes the outcome on
// a per-user result channel. Persistence and SSE fanout are the
// backend's responsibility — this task is pure compute.
export const aiPreviewTask: Task<AIPreviewPayload> = {
  type: 'ai_preview',
  schema: aiPreviewPayloadSchema,
  handle,
};
