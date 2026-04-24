import { z } from 'zod';

import type { Task } from '../../framework';
import { handle } from './handle';

export const aiPreviewPayloadSchema = z.object({
  user_id: z.string().min(1),
  record_id: z.string().min(1),
  content: z.string().min(1),
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
