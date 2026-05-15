// Onboarding A2 화면 unit test — Case A 의 태아 정보 입력 화면.
//
// e2e (Maestro) 는 사양 단위로 date 경로만 검증한다. 이전 maestro 의
// stage1-skip 에서 검증하던 ① 화면 카피 어셋션과 ② [아직 정해지지 않았어요]
// skip 동작은 사양에 없는 구현 디테일이라 본 jest 가 회귀를 책임진다.
//
// q1.test.tsx 와 동일한 mock 패턴(react-native-safe-area-context + expo-router
// + OnboardingContext).

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

import OnboardingA2 from '../a2';

describe('Onboarding A2', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUpdateFetus.mockClear();
    mockSetCurrentFetusIndex.mockClear();
  });

  it('renders the helper copy and field labels', () => {
    const { getByText } = render(<OnboardingA2 />);
    // 헬퍼 카피 + 필드라벨 + 양쪽 예정일 입력 옵션
    expect(getByText('기록 가이드를 맞춰 보여드릴게요')).toBeTruthy();
    expect(getByText('예정일')).toBeTruthy();
    expect(getByText('날짜 선택하기')).toBeTruthy();
    expect(getByText('아직 정해지지 않았어요')).toBeTruthy();
    // 성별 옵션 카피
    expect(getByText('여자아이')).toBeTruthy();
    expect(getByText('남자아이')).toBeTruthy();
    // 임신 주차 라벨
    expect(getByText('임신 주차')).toBeTruthy();
  });

  it('clears due_date and lets the user advance when skip is tapped', () => {
    const { getByTestId } = render(<OnboardingA2 />);
    fireEvent.press(getByTestId('onboarding-a2-due-date-skip'));
    // skip 은 dueDate 를 명시적으로 undefined 로 set 한다.
    expect(mockUpdateFetus).toHaveBeenCalledWith(0, { dueDate: undefined });
    // skip 후 [다음] 으로 a3 진입 가능 — context 에 due_date 없는 채로 진행.
    fireEvent.press(getByTestId('onboarding-a2-next'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/a3');
  });
});
