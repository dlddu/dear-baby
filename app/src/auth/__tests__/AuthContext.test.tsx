// AuthProvider 부트 시퀀스의 상태 전이를 잠근다. 핵심은 /me 실패의 세 갈래:
//   (1) refresh 만료로 토큰이 지워진 경우(장기 미접속) → 캐시가 있어도
//       unauthenticated — 랜딩에서 재로그인. 이전에는 'authenticated' 로
//       폴백해 모든 API 가 401 인 좀비 홈 화면에 갇혔다.
//   (2) 일시 장애(토큰 보존) + 온보딩 캐시 있음 → authenticated 유지.
//   (3) 일시 장애 + 캐시 없음 → 토큰 삭제 후 unauthenticated.
// tokens.ts / onboardingCache.ts 는 mock 하지 않고 in-memory SecureStore
// 위에서 실제 구현을 그대로 돌린다.

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
  };
});

jest.mock('../../api/auth', () => ({
  me: jest.fn(),
  logout: jest.fn(),
}));

// client 는 setSessionExpiredHandler 만 mock 한다 — AuthProvider 가 부트 시
// 등록하는 강제 로그아웃 핸들러를 캡처해 직접 호출하기 위함이다.
jest.mock('../../api/client', () => ({
  setSessionExpiredHandler: jest.fn(),
}));

jest.mock('../../api/records', () => ({
  createTextRecord: jest.fn(),
  createVoiceRecord: jest.fn(),
}));

jest.mock('../../api/users', () => ({
  submitOnboardingCaseA: jest.fn(),
  submitOnboardingCaseB: jest.fn(),
  submitOnboardingCaseC: jest.fn(),
}));

import { act, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { Text } from 'react-native';

import { me } from '../../api/auth';
import { setSessionExpiredHandler } from '../../api/client';
import type { User } from '../../api/types';
import { AuthProvider, useAuth } from '../AuthContext';

const mockMe = me as jest.MockedFunction<typeof me>;
const mockSetSessionExpiredHandler =
  setSessionExpiredHandler as jest.MockedFunction<
    typeof setSessionExpiredHandler
  >;

const secureStoreMock = SecureStore as unknown as {
  __reset: () => void;
  __seed: (key: string, value: string) => void;
  __has: (key: string) => boolean;
};

const ACCESS_KEY = 'db_access_token';
const REFRESH_KEY = 'db_refresh_token';
const ONBOARDED_AT_KEY = 'db_onboarded_at';

const baseUser = {
  id: 'user-1',
  email: 'a@b.c',
  name: 'Mom',
  picture_url: '',
  onboarded_at: '2026-05-01T00:00:00Z',
  first_record_at: null,
  fetuses: [],
  children: [],
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
} satisfies User;

function StatusProbe() {
  const { status } = useAuth();
  return <Text testID="auth-status">{status}</Text>;
}

function renderAuth() {
  return render(
    <AuthProvider>
      <StatusProbe />
    </AuthProvider>,
  );
}

async function expectStatus(
  getByTestId: (id: string) => { props: { children: React.ReactNode } },
  expected: string,
) {
  await waitFor(() =>
    expect(getByTestId('auth-status').props.children).toBe(expected),
  );
}

function seedTokens() {
  secureStoreMock.__seed(ACCESS_KEY, 'stored-access');
  secureStoreMock.__seed(REFRESH_KEY, 'stored-refresh');
}

beforeEach(() => {
  secureStoreMock.__reset();
  mockMe.mockReset();
  mockSetSessionExpiredHandler.mockClear();
});

describe('AuthProvider 부트 — 정상 경로', () => {
  it('저장된 토큰이 없으면 unauthenticated 로 전이한다', async () => {
    const { getByTestId } = renderAuth();
    await expectStatus(getByTestId, 'unauthenticated');
    expect(mockMe).not.toHaveBeenCalled();
  });

  it('/me 성공 + onboarded_at 있음 → authenticated', async () => {
    seedTokens();
    mockMe.mockResolvedValue(baseUser);

    const { getByTestId } = renderAuth();
    await expectStatus(getByTestId, 'authenticated');
    // 온보딩 캐시가 user 값으로 미러링된다.
    expect(secureStoreMock.__has(ONBOARDED_AT_KEY)).toBe(true);
  });

  it('/me 성공 + onboarded_at 없음(신규 가입) → onboarding', async () => {
    seedTokens();
    mockMe.mockResolvedValue({ ...baseUser, onboarded_at: null });

    const { getByTestId } = renderAuth();
    await expectStatus(getByTestId, 'onboarding');
  });
});

describe('AuthProvider 부트 — /me 실패 폴백', () => {
  it('장기 미접속: refresh 만료로 토큰이 지워졌으면 캐시가 있어도 unauthenticated', async () => {
    seedTokens();
    secureStoreMock.__seed(ONBOARDED_AT_KEY, '2026-05-01T00:00:00Z');
    // apiFetch 내부의 401→refresh(401) 경로가 clearTokens() 를 실행한 뒤
    // me() 가 최종 실패하는 실제 시퀀스를 재현한다.
    mockMe.mockImplementation(async () => {
      await SecureStore.deleteItemAsync(ACCESS_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      throw new Error('me failed: 401');
    });

    const { getByTestId } = renderAuth();
    await expectStatus(getByTestId, 'unauthenticated');
    // 강제 로그아웃과 동일한 로컬 정리 — 다음 부팅이 이전 사용자의
    // 캐시를 참조하지 않는다.
    expect(secureStoreMock.__has(ONBOARDED_AT_KEY)).toBe(false);
  });

  it('일시 장애(토큰 보존) + 온보딩 캐시 있음 → authenticated 유지', async () => {
    seedTokens();
    secureStoreMock.__seed(ONBOARDED_AT_KEY, '2026-05-01T00:00:00Z');
    mockMe.mockRejectedValue(new Error('me failed: 500'));

    const { getByTestId } = renderAuth();
    await expectStatus(getByTestId, 'authenticated');
    // 토큰은 남아 있어야 이후 401→refresh 로 세션을 회복할 수 있다.
    expect(secureStoreMock.__has(ACCESS_KEY)).toBe(true);
    expect(secureStoreMock.__has(REFRESH_KEY)).toBe(true);
  });

  it('일시 장애(토큰 보존) + 캐시 없음 → 토큰 삭제 후 unauthenticated', async () => {
    seedTokens();
    mockMe.mockRejectedValue(new Error('me failed: 500'));

    const { getByTestId } = renderAuth();
    await expectStatus(getByTestId, 'unauthenticated');
    expect(secureStoreMock.__has(ACCESS_KEY)).toBe(false);
    expect(secureStoreMock.__has(REFRESH_KEY)).toBe(false);
  });
});

describe('AuthProvider — 세션 중 강제 로그아웃 (session-expired 통지)', () => {
  it('등록된 핸들러 호출 시 authenticated → unauthenticated + 온보딩 캐시 정리', async () => {
    seedTokens();
    secureStoreMock.__seed(ONBOARDED_AT_KEY, '2026-05-01T00:00:00Z');
    mockMe.mockResolvedValue(baseUser);

    const { getByTestId } = renderAuth();
    await expectStatus(getByTestId, 'authenticated');

    // 실제로는 apiFetch 의 refresh 401 경로가 이 핸들러를 호출한다. 부트 시
    // AuthProvider 가 등록한 콜백을 직접 실행해 강제 로그아웃 전이를 검증한다.
    const handler = mockSetSessionExpiredHandler.mock.calls.at(-1)?.[0];
    expect(typeof handler).toBe('function');
    await act(async () => {
      handler!();
    });

    await expectStatus(getByTestId, 'unauthenticated');
    // signOut 과 동일하게 다음 부팅이 이전 사용자 캐시를 참조하지 않도록 정리.
    expect(secureStoreMock.__has(ONBOARDED_AT_KEY)).toBe(false);
  });
});
