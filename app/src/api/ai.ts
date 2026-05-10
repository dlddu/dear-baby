import EventSource from 'react-native-sse';

import { posthogClient, posthogHeaders } from '../analytics/client';
import { API_URL } from '../config/env';
import { getAccessToken } from '../auth/tokens';
import { apiFetch } from './client';

// requestAiPreview kicks off (or retries) AI preview generation. The
// backend responds 202 regardless of whether this is the first run or a
// retry — retries simply overwrite the existing preview.
export async function requestAiPreview(): Promise<void> {
  const res = await apiFetch('/onboarding/ai-preview', { method: 'POST' });
  if (!res.ok) {
    throw new Error(`requestAiPreview failed: ${res.status}`);
  }
  posthogClient?.capture('ai_preview_requested');
}

// AiPreviewEvent is the union of SSE events the home screen cares about.
export type AiPreviewEvent =
  | { type: 'ready'; preview: string }
  | { type: 'error'; error: string };

// openAiPreviewStream opens a long-lived SSE connection to the backend
// AI-preview event stream. Returns a close function; the caller owns the
// connection lifecycle (open in useEffect → close in cleanup).
//
// Auth: react-native-sse supports headers so we use Bearer. The backend
// also accepts a `?token=` query fallback for platforms where header
// injection is unreliable.
type AiCustomEventType = 'ready';

export function openAiPreviewStream(
  onEvent: (event: AiPreviewEvent) => void,
  onError: (error: Error) => void,
): () => void {
  let closed = false;
  let source: EventSource<AiCustomEventType> | null = null;

  (async () => {
    const token = await getAccessToken();
    if (closed) return;
    if (!token) {
      onError(new Error('no access token'));
      return;
    }
    const url = `${API_URL}/v1/onboarding/ai-preview/events`;
    source = new EventSource<AiCustomEventType>(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...posthogHeaders(),
      },
      // EventSource in react-native-sse doesn't auto-reconnect by default.
      // We let it stay closed on error — the home effect reopens the
      // stream when status conditions change, which is a simpler flow
      // than tracking reconnect state here.
    });

    source.addEventListener('ready', (e) => {
      if (closed) return;
      try {
        const data = JSON.parse(e.data ?? '');
        const preview: string =
          typeof data?.preview === 'string' ? data.preview : '';
        if (!preview) {
          onError(new Error('empty preview in ready event'));
          return;
        }
        onEvent({ type: 'ready', preview });
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    source.addEventListener('error', (e) => {
      if (closed) return;
      // Backend error events carry JSON in `data`; built-in transport
      // errors carry a `message` property. Handle both.
      const msg =
        'data' in e && typeof e.data === 'string'
          ? e.data
          : 'message' in e && typeof e.message === 'string'
            ? e.message
            : 'stream error';
      try {
        const data = JSON.parse(msg);
        onEvent({
          type: 'error',
          error: typeof data?.error === 'string' ? data.error : msg,
        });
      } catch {
        onEvent({ type: 'error', error: msg });
      }
    });
  })().catch(onError);

  return () => {
    closed = true;
    if (source) {
      source.removeAllEventListeners();
      source.close();
      source = null;
    }
  };
}
