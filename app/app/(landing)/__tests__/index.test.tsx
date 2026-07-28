// 랜딩 화면의 E2E 전용 빠른 테스터 로그인 진입점(`tester-login-fast`) 잠금.
//
// 이 trigger 는 15탭 제스처를 우회하므로 스토어 빌드에 절대 새면 안 된다.
// 그래서 두 방향을 모두 못박는다:
//   1) 플래그가 없는 기본(=프로덕션) 빌드에서는 렌더되지 않는다.
//   2) 플래그가 켜진 E2E 빌드에서는 한 번의 press 로 테스터 로그인 모달이
//      뜬다 (모달 자체·서버 호출은 그대로라 여기서는 표시 여부만 본다).
//
// env 모듈을 `jest.isolateModules` 로 다시 로드하면 React 사본이 둘로 갈려
// hooks dispatcher 가 null 이 된다. 대신 config/env 를 getter 로 mock 해
// 두고 렌더 직전에 값만 바꾼다 — 화면은 플래그를 렌더 시점에 읽으므로
// 모듈 재로드가 필요 없다. jest.mock 팩토리는 `mock` 접두사 변수만 캡처할
// 수 있어 이름이 mockFastTesterLogin 이다.

import { act, fireEvent, render } from '@testing-library/react-native';

let mockFastTesterLogin = false;

jest.mock('../../../src/config/env', () => ({
  API_URL: 'http://localhost:8080',
  get E2E_FAST_TESTER_LOGIN() {
    return mockFastTesterLogin;
  },
  GOOGLE_IOS_CLIENT_ID: '',
  GOOGLE_WEB_CLIENT_ID: '',
}));

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...rest }: any) =>
      React.createElement(View, rest, children),
  };
});

// Apple/Google 버튼은 이 테스트의 관심사가 아니다. 네이티브 모듈이 jest
// 환경에서 로드되지 않도록 최소 표면만 남긴다. isAvailableAsync 가 false 를
// resolve 하면 AppleSignInButton 은 null 을 렌더하고, GOOGLE_WEB_CLIENT_ID
// 가 빈 문자열이라 Google 버튼도 렌더되지 않는다.
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: () => Promise.resolve(false),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    hasPlayServices: jest.fn(),
  },
  isErrorWithCode: () => false,
  isSuccessResponse: () => false,
  statusCodes: { SIGN_IN_CANCELLED: 'CANCELLED' },
}));

jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({ setSession: jest.fn() }),
}));

import Landing from '../index';

// 랜딩 화면은 마운트 즉시 /health 를 친다. 테스트가 네트워크를 타지 않도록
// ok 응답으로 고정한다 (에러 토스트 경로는 health.yaml E2E 담당).
beforeEach(() => {
  mockFastTesterLogin = false;
  (global as any).fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ status: 'ok' }) }),
  );
});

afterEach(() => {
  delete (global as any).fetch;
});

// 주어진 E2E 플래그 상태로 랜딩 화면을 렌더한다. 렌더 후 빈 async act 로
// 대기 중인 microtask 를 비워 마운트 직후의 /health 응답이 act 안에서
// 정착하게 한다 — 안 그러면 fetch 가 풀린 뒤의 setHealthChecked 가 act
// 경고를 낸다. render 자체를 act 안에 넣으면 RTL 이 act 스코프 밖에서
// 결과를 만들다 "unmounted test renderer" 로 터지므로 분리해 둔다.
async function renderLanding(fastTesterLogin: boolean) {
  mockFastTesterLogin = fastTesterLogin;
  const result = render(<Landing />);
  await act(async () => {});
  return result;
}

describe('랜딩 — 빠른 테스터 로그인 진입점', () => {
  it('플래그가 꺼진 기본 빌드에는 trigger 가 없다', async () => {
    const { queryByTestId, getByTestId } = await renderLanding(false);

    expect(queryByTestId('tester-login-fast')).toBeNull();
    // 실제 게이트인 코너 히트존은 그대로 남아 있어야 한다.
    expect(getByTestId('tester-corner-tl')).toBeTruthy();
    expect(getByTestId('tester-corner-tr')).toBeTruthy();
  });

  it('플래그가 꺼져 있으면 모달도 닫힌 상태다', async () => {
    const { queryByTestId } = await renderLanding(false);

    expect(queryByTestId('tester-login-modal')).toBeNull();
  });

  it('플래그가 켜진 E2E 빌드에서는 한 번의 press 로 모달이 열린다', async () => {
    const { getByTestId, queryByTestId } = await renderLanding(true);

    expect(queryByTestId('tester-login-modal')).toBeNull();

    fireEvent.press(getByTestId('tester-login-fast'));

    expect(getByTestId('tester-login-modal')).toBeTruthy();
    // 자격증명은 여전히 모달에 입력한다 — trigger 는 진입 경로만 줄인다.
    expect(getByTestId('tester-login-email')).toBeTruthy();
    expect(getByTestId('tester-login-password')).toBeTruthy();
  });

  it('플래그가 켜져도 15탭 제스처 경로는 그대로 남는다', async () => {
    const { getByTestId } = await renderLanding(true);

    expect(getByTestId('tester-corner-tl')).toBeTruthy();
    expect(getByTestId('tester-corner-tr')).toBeTruthy();
  });
});
