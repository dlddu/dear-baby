// 설정 탭 로그아웃 — 확인 다이얼로그·진행 상태·에러 처리·한국어 라벨을 잠근다.
// signOut 은 mock 이라 성공 시 언마운트가 일어나지 않으므로, 성공 후 버튼이
// "로그아웃 중…" 상태로 남는 것으로 진행 피드백을 검증한다(실제 앱에서는
// AuthGate 가 랜딩으로 replace 하며 이 화면이 사라진다).

import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = ({ children, ...rest }: any) =>
    React.createElement(View, rest, children);
  return { SafeAreaView: passthrough };
});

const mockSignOut = jest.fn();
jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'mom@dear.baby' }, signOut: mockSignOut }),
}));

import SettingsTab from '../settings';

type AlertButton = {
  text?: string;
  style?: string;
  onPress?: () => void | Promise<void>;
};

// confirmPressFrom pulls the destructive "로그아웃" button's onPress out of the
// most recent Alert.alert(...) call so a test can simulate the user confirming.
function confirmPressFrom(alertSpy: jest.SpyInstance): () => void | Promise<void> {
  const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
  const confirm = buttons.find((b) => b.style === 'destructive');
  if (!confirm?.onPress) throw new Error('destructive 확인 버튼이 없다');
  return confirm.onPress;
}

beforeEach(() => {
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SettingsTab — 로그아웃', () => {
  it('버튼 라벨이 한국어 "로그아웃" 이다', () => {
    const { getByText } = render(<SettingsTab />);
    expect(getByText('로그아웃')).toBeTruthy();
  });

  it('버튼을 눌러도 곧바로 로그아웃하지 않고 확인 다이얼로그를 띄운다', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<SettingsTab />);

    fireEvent.press(getByTestId('sign-out-button'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('로그아웃');
    // 확인하기 전에는 signOut 이 호출되지 않는다 — 오탭 방지.
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('확인 시 signOut 을 호출하고 버튼을 진행 상태로 바꾼다', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId, getByText } = render(<SettingsTab />);

    fireEvent.press(getByTestId('sign-out-button'));
    await act(async () => {
      await confirmPressFrom(alertSpy)();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    // 진행 피드백: 성공 후에도(언마운트 전) 버튼은 비활성 + "로그아웃 중…".
    expect(getByText('로그아웃 중…')).toBeTruthy();
  });

  it('signOut 실패 시 에러 다이얼로그를 띄우고 버튼을 다시 활성화한다', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('secure store down'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { getByTestId, getByText } = render(<SettingsTab />);

    fireEvent.press(getByTestId('sign-out-button'));
    await act(async () => {
      await confirmPressFrom(alertSpy)();
    });

    // 확인(1) + 실패 안내(2).
    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(alertSpy.mock.calls[1][0]).toBe('로그아웃하지 못했어요');
    // 재시도할 수 있도록 버튼은 다시 "로그아웃" 으로 복귀한다.
    expect(getByText('로그아웃')).toBeTruthy();
  });
});
