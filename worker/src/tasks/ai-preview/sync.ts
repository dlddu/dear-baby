import type { TaskDeps } from '../../deps.js';
import { handleAIPreview } from './handle.js';

// syncAIPreviews is the self-heal path. On worker boot it asks the backend
// "which users have first_record_at set but ai_preview still null?" and
// runs handleAIPreview directly (bypassing Redis) for each one. This covers
// the case where Redis lost the enqueued job — e.g. the Redis pod restarted
// while a worker pod was down.
export async function syncAIPreviews(deps: TaskDeps): Promise<void> {
  const pending = await deps.backend.listPendingAIPreviews();
  deps.logger.info({ count: pending.length }, 'ai_preview sync: pending users');
  for (const p of pending) {
    try {
      await handleAIPreview(
        {
          user_id: p.user_id,
          record_id: p.record_id,
          content: p.content,
        },
        deps,
      );
    } catch (err) {
      // handleAIPreview already logs + publishes; a thrown error here would
      // only happen on a completely unexpected failure path. Swallow it so
      // one bad user doesn't block the rest of the sync.
      deps.logger.error(
        { err, userId: p.user_id },
        'sync: handleAIPreview threw unexpectedly',
      );
    }
  }
}
