// Onboarding Q1 화면 unit test — 분기 진입 첫 화면이라 회귀 시 무료한 흐름
// 전체가 망가지기 때문에, 가장 좋아하는 두 가지 안전망만 친다:
//   1) "네" 선택 시 setQ1(true) 호출 + Q2 push
//   2) "아니요" 선택 시 setQ1(false) 호출 + Q2 push
//
// 상위 OnboardingProvider 와 expo-router 는 mock 해서 화면 자체의 행동만
// 검증한다. SafeAreaView 는 공식 jest mock 을 사용.
//
// jest.mock 팩토리는 모듈 스코프 변수를 캡처할 수 없어 (mock prefix 만 허용)
// `mockPush` / `mockSetQ1` 라는 이름으로 jest.fn 을 들고 다닌다.

import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = ({ children, ...rest }: any) =>
    React.createElement(View, rest, children);
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 320, height: 640 }),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 320, height: 640 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSetQ1 = jest.fn();
jest.mock('../../../src/onboarding/OnboardingContext', () => ({
  useOnboarding: () => ({ setQ1: mockSetQ1 }),
}));

import OnboardingQ1 from '../q1';

describe('Onboarding Q1', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSetQ1.mockClear();
  });

  it('renders both Yes/No options', () => {
    const { getByTestId } = render(<OnboardingQ1 />);
    expect(getByTestId('onboarding-q1')).toBeTruthy();
    expect(getByTestId('onboarding-q1-yes')).toBeTruthy();
    expect(getByTestId('onboarding-q1-no')).toBeTruthy();
  });

  it('saves Q1=true and pushes to Q2 when "Yes" is tapped', () => {
    const { getByTestId } = render(<OnboardingQ1 />);
    fireEvent.press(getByTestId('onboarding-q1-yes'));
    expect(mockSetQ1).toHaveBeenCalledWith(true);
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/q2');
  });

  it('saves Q1=false and pushes to Q2 when "No" is tapped', () => {
    const { getByTestId } = render(<OnboardingQ1 />);
    fireEvent.press(getByTestId('onboarding-q1-no'));
    expect(mockSetQ1).toHaveBeenCalledWith(false);
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/q2');
  });
});
