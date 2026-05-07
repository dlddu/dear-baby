import { posthogHeaders } from '../analytics/client';
import { API_BASE_URL } from '../config/env';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../auth/tokens';

// refreshingPromise coalesces concurrent refresh attempts so that a burst of
// 401s triggers only one /auth/refresh call.
let refreshingPromise: Promise<string | null> | null = null;

async function refreshAccessOnce(): Promise<string | null> {
  if (refreshingPromise) return refreshingPromise;
  refreshingPromise = (async () => {
    const refresh = await getRefreshToken();
    if (!refresh) return null;
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      await clearTokens();
      return null;
    }
    const json = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };
    await setTokens(json.access_token, json.refresh_token);
    return json.access_token;
  })();
  try {
    return await refreshingPromise;
  } finally {
    refreshingPromise = null;
  }
}

// apiFetch is a thin fetch wrapper that injects the Authorization header and
// transparently refreshes the access token on 401. It does NOT try to handle
// anything else — callers handle their own status codes.
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const access = await getAccessToken();
  const headers = new Headers(init.headers);
  if (access) headers.set('Authorization', `Bearer ${access}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // Forward PostHog correlation IDs so backend logs can be linked back to
  // the recorded session in the PostHog UI.
  for (const [k, v] of Object.entries(posthogHeaders())) {
    headers.set(k, v);
  }

  let res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (res.status === 401 && access) {
    const newAccess = await refreshAccessOnce();
    if (newAccess) {
      headers.set('Authorization', `Bearer ${newAccess}`);
      res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    }
  }
  return res;
}
