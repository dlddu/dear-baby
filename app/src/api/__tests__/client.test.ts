// apiFetch 의 401 자동 갱신 계약을 단위 레벨에서 고정한다.
// 특히 refresh 실패의 두 갈래 — 401(확정 만료)은 토큰 삭제, 5xx(일시
// 장애)는 토큰 보존 — 를 잠근다. 후자가 삭제로 바뀌면 백엔드 순단만으로
// 사용자가 강제 로그아웃된다.

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn((key: string) =>
      Promise.resolve(store.has(key) ? store.get(key)! : null),
    ),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    __reset: () => store.clear(),
    __seed: (key: string, value: string) => store.set(key, value),
    __has: (key: string) => store.has(key),
    __get: (key: string) => store.get(key) ?? null,
  };
});

jest.mock('../../analytics/client', () => ({
  posthogHeaders: () => ({}),
}));

import * as SecureStore from 'expo-secure-store';

import { apiFetch } from '../client';

const secureStoreMock = SecureStore as unknown as {
  __reset: () => void;
  __seed: (key: string, value: string) => void;
  __has: (key: string) => boolean;
  __get: (key: string) => string | null;
};

const ACCESS_KEY = 'db_access_token';
const REFRESH_KEY = 'db_refresh_token';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function response(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function seedTokens() {
  secureStoreMock.__seed(ACCESS_KEY, 'old-access');
  secureStoreMock.__seed(REFRESH_KEY, 'old-refresh');
}

beforeEach(() => {
  secureStoreMock.__reset();
  mockFetch.mockReset();
});

describe('apiFetch — Bearer 주입', () => {
  it('저장된 access 토큰을 Authorization 헤더로 첨부한다', async () => {
    seedTokens();
    mockFetch.mockResolvedValueOnce(response(200));

    const res = await apiFetch('/me');

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8080/v1/me');
    expect((init.headers as Headers).get('Authorization')).toBe(
      'Bearer old-access',
    );
  });

  it('access 토큰이 없으면 헤더 없이 보내고 401 이어도 refresh 를 시도하지 않는다', async () => {
    mockFetch.mockResolvedValueOnce(response(401));

    const res = await apiFetch('/me');

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    expect((init.headers as Headers).get('Authorization')).toBeNull();
  });
});

describe('apiFetch — 401 자동 갱신', () => {
  it('401 → refresh 성공 시 새 토큰 쌍을 저장하고 원 요청을 1회 재시도한다', async () => {
    seedTokens();
    mockFetch
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(
        response(200, {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
        }),
      )
      .mockResolvedValueOnce(response(200, { id: 'user-1' }));

    const res = await apiFetch('/me');

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    const [refreshUrl, refreshInit] = mockFetch.mock.calls[1];
    expect(refreshUrl).toBe('http://localhost:8080/v1/auth/refresh');
    expect(JSON.parse(refreshInit.body as string)).toEqual({
      refresh_token: 'old-refresh',
    });

    // 회전(rotation): 두 토큰 모두 새 값으로 교체된다.
    expect(secureStoreMock.__get(ACCESS_KEY)).toBe('new-access');
    expect(secureStoreMock.__get(REFRESH_KEY)).toBe('new-refresh');

    const [, retryInit] = mockFetch.mock.calls[2];
    expect((retryInit.headers as Headers).get('Authorization')).toBe(
      'Bearer new-access',
    );
  });

  it('refresh 가 401 이면(만료·회수) 토큰 쌍을 삭제하고 원래 401 을 반환한다', async () => {
    seedTokens();
    mockFetch
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401));

    const res = await apiFetch('/me');

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(secureStoreMock.__has(ACCESS_KEY)).toBe(false);
    expect(secureStoreMock.__has(REFRESH_KEY)).toBe(false);
  });

  it('refresh 가 5xx 이면(일시 장애) 토큰을 보존하고 원래 401 을 반환한다', async () => {
    seedTokens();
    mockFetch
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(500));

    const res = await apiFetch('/me');

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // 다음 401 때 같은 refresh 토큰으로 재시도할 수 있어야 한다.
    expect(secureStoreMock.__get(ACCESS_KEY)).toBe('old-access');
    expect(secureStoreMock.__get(REFRESH_KEY)).toBe('old-refresh');
  });
});
