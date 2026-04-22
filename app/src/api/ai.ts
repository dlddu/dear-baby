import { API_URL } from '../config/env';
import { getAccessToken } from '../auth/tokens';
import { apiFetch } from './client';

// requestAiPreview POSTs to /onboarding/ai-preview to kick off (or retry) an
// AI edit of the user's first record. Returns on 202; 400 means the user
// hasn't saved a record yet and the caller should leave the card in teaser.
export async function requestAiPreview(): Promise<void> {
  const res = await apiFetch('/onboarding/ai-preview', { method: 'POST' });
  if (res.status === 202) return;
  throw new Error(`requestAiPreview failed: ${res.status}`);
}

export type AiPreviewEvent =
  | { status: 'ok'; preview: string }
  | { status: 'error'; error?: string };

// openAiPreviewStream opens an EventSource to /onboarding/ai-preview/events.
// RN fetch doesn't stream SSE reliably, so we pass the access token as a
// `?token=` query string (backend accepts either header or query) and parse
// `data: {...}` frames manually from the streaming body.
//
// Returns a cancel function that closes the underlying connection.
export function openAiPreviewStream(
  onEvent: (e: AiPreviewEvent) => void,
  onError: (err: unknown) => void,
): () => void {
  const controller = new AbortController();
  let cancelled = false;

  (async () => {
    try {
      const access = await getAccessToken();
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      if (access) headers.Authorization = `Bearer ${access}`;
      const res = await fetch(`${API_URL}/onboarding/ai-preview/events`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        onError(new Error(`SSE open failed: ${res.status}`));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (!cancelled) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = frame
            .split('\n')
            .find((l) => l.startsWith('data:'));
          if (!line) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try {
            const parsed = JSON.parse(json) as AiPreviewEvent;
            onEvent(parsed);
          } catch (e) {
            onError(e);
          }
        }
      }
    } catch (err) {
      if (!cancelled) onError(err);
    }
  })();

  return () => {
    cancelled = true;
    controller.abort();
  };
}
