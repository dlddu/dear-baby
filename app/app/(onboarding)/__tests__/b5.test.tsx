// Onboarding B5 화면 unit test — Case B 다태 태아 정보 입력 화면.
//
// a2.test.tsx 와 동일한 의도: e2e 는 date 경로만 검증하고, sk[ip] 카피·동작은
// 본 jest 가 책임진다. b5 는 testID 에 인덱스 접미사가 붙는다
// (`onboarding-b5-due-date-skip-{i}`).

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
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  // 0 번째 태아 인스턴스 가정 — 단태일 때도 동일 경로.
  useLocalSearchParams: () => ({ index: '0' }),
}));

const mockUpdateFetus = jest.fn();
const mockSetCurrentFetusIndex = jest.fn();
jest.mock('../../../src/onboarding/OnboardingContext', () => ({
  useOnboarding: () => ({
    fetusCount: 1,
    fetuses: [{}],
    updateFetus: mockUpdateFetus,
    setCurrentFetusIndex: mockSetCurrentFetusIndex,
  }),
}));

import OnboardingB5 from '../b5';

describe('Onboarding B5', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUpdateFetus.mockClear();
    mockSetCurrentFetusIndex.mockClear();
  });

  it('renders the helper copy and field labels', () => {
    const { getByText } = render(<OnboardingB5 />);
    expect(getByText('예정일')).toBeTruthy();
    expect(getByText('날짜 선택하기')).toBeTruthy();
    expect(getByText('아직 정해지지 않았어요')).toBeTruthy();
    expect(getByText('여자아이')).toBeTruthy();
    expect(getByText('남자아이')).toBeTruthy();
    expect(getByText('임신 주차')).toBeTruthy();
  });

  it('clears due_date and lets the user advance when skip-0 is tapped', () => {
    const { getByTestId } = render(<OnboardingB5 />);
    fireEvent.press(getByTestId('onboarding-b5-due-date-skip-0'));
    expect(mockUpdateFetus).toHaveBeenCalledWith(0, { dueDate: undefined });
    // 단태 (fetusCount=1) 일 때 [다음] 은 b6 로 push.
    fireEvent.press(getByTestId('onboarding-b5-next'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/b6');
  });
});
