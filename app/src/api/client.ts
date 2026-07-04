import { posthogHeaders } from '../analytics/client';
import { API_URL } from '../config/env';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../auth/tokens';

// refreshingPromise coalesces concurrent refresh attempts so that a burst of
// 401s triggers only one /v1/auth/refresh call.
let refreshingPromise: Promise<string | null> | null = null;

// sessionExpiredHandler bridges this non-React layer back to AuthContext.
// When the refresh token itself is rejected (401) we clear the token pair
// here, but this module can't move the UI. AuthContext registers a handler
// on mount so the app can drop to the landing screen *immediately* instead
// of stranding the user on an authenticated screen where every call 401s
// until the next app launch.
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(
  handler: (() => void) | null,
): void {
  sessionExpiredHandler = handler;
}

async function refreshAccessOnce(): Promise<string | null> {
  if (refreshingPromise) return refreshingPromise;
  refreshingPromise = (async () => {
    const refresh = await getRefreshToken();
    if (!refresh) return null;
    const res = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      // Only a 401 means the refresh token itself is expired/revoked — the
      // session is definitively dead, so drop the pair (AuthContext's boot
      // fallback reads their absence as "re-login required"). Any other
      // failure (5xx, gateway hiccup) is transient: keep the tokens so a
      // later 401 can retry the refresh and recover the session.
      if (res.status === 401) {
        await clearTokens();
        // Session is definitively dead — tell AuthContext to log out now so
        // the user isn't left on a zombie authenticated screen until restart.
        sessionExpiredHandler?.();
      }
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

  let res = await fetch(`${API_URL}/v1${path}`, { ...init, headers });
  if (res.status === 401 && access) {
    const newAccess = await refreshAccessOnce();
    if (newAccess) {
      headers.set('Authorization', `Bearer ${newAccess}`);
      res = await fetch(`${API_URL}/v1${path}`, { ...init, headers });
    }
  }
  return res;
}
