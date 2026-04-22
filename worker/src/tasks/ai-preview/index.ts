import { z } from 'zod';

import type { Task } from '../../framework.js';
import { handleAIPreview } from './handle.js';
import { syncAIPreviews } from './sync.js';

const schema = z.object({
  user_id: z.string().min(1),
  record_id: z.string().min(1),
  content: z.string().min(1),
});

export type AIPreviewPayload = z.infer<typeof schema>;

// aiPreviewTask is the Stage 2 "edit the first record" job. Called once per
// user as they complete onboarding; retries go through the same task.
export const aiPreviewTask: Task<AIPreviewPayload> = {
  type: 'ai_preview',
  schema,
  handle: handleAIPreview,
  sync: syncAIPreviews,
};
