import type { TaskDeps } from '../../deps';
import { errMessage } from '../../framework';

import { handle } from './handle';

// sync is run at worker boot. It asks the backend which users have a
// first_record stamped but no AI preview yet, and calls handle() for each
// one sequentially — bypassing Redis entirely. This guards against
// Redis losing a job (pod restart, network flake) since we have no
// persistence configured. Concurrent workers are acceptable: each job
// idempotently writes the same preview text, and duplicate publishes are
// harmless on the SSE hub side.
export async function sync(deps: TaskDeps): Promise<void> {
  const log = deps.logger.child({ task: 'ai_preview', phase: 'sync' });

  let pending: Awaited<ReturnType<typeof deps.backend.listPendingAIPreviews>>;
  try {
    pending = await deps.backend.listPendingAIPreviews();
  } catch (err) {
    log.error({ err: errMessage(err) }, 'failed to list pending previews');
    return;
  }

  if (pending.length === 0) {
    log.debug('no pending previews');
    return;
  }
  log.info({ count: pending.length }, 'replaying pending previews');

  for (const item of pending) {
    await handle(
      {
        user_id: item.user_id,
        record_id: item.record_id,
        content: item.content,
      },
      deps,
    );
  }
}
