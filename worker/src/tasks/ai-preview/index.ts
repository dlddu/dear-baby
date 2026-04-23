import { z } from 'zod';

import type { Task } from '../../framework';
import { handle } from './handle';
import { sync } from './sync';

export const aiPreviewPayloadSchema = z.object({
  user_id: z.string().min(1),
  record_id: z.string().min(1),
  content: z.string().min(1),
});

export type AIPreviewPayload = z.infer<typeof aiPreviewPayloadSchema>;

// The ai_preview task reads the user's first record, asks an LLM to
// polish it into a short emotional preview, writes the result back via
// the backend internal API, and publishes the outcome on a per-user
// result channel so the SSE hub can fan out to subscribed clients.
export const aiPreviewTask: Task<AIPreviewPayload> = {
  type: 'ai_preview',
  schema: aiPreviewPayloadSchema,
  handle,
  sync,
};
