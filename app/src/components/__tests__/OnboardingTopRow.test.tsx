// OnboardingTopRow 컴포넌트 unit test — 16개 온보딩 화면이 공유하는 상단
// 행(ProgressDots + 옵션 Badge)의 렌더 분기를 잠가둔다.
//
// 핵심 분기: count <= 1 또는 index 미지정 시 Badge 미노출.
// Maestro 가 의존하는 Badge testID 포맷 (`${testIDPrefix}-${index}`) 도 동결한다.

import { render } from '@testing-library/react-native';

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

import { OnboardingTopRow } from '../OnboardingTopRow';

describe('OnboardingTopRow', () => {
  it('renders ProgressDots without Badge when count is omitted', () => {
    const { queryByText } = render(<OnboardingTopRow current={0} total={5} />);
    expect(queryByText('1/2')).toBeNull();
    expect(queryByText('1/1')).toBeNull();
  });

  it('renders ProgressDots without Badge when count is 1 (single instance)', () => {
    const { queryByText } = render(
      <OnboardingTopRow current={2} total={5} index={0} count={1} />,
    );
    expect(queryByText('1/1')).toBeNull();
  });

  it('renders Badge with `${index + 1}/${count}` label when count > 1', () => {
    const { getByText } = render(
      <OnboardingTopRow
        current={3}
        total={5}
        index={1}
        count={2}
        testIDPrefix="onboarding-a2-fetus-index"
      />,
    );
    expect(getByText('2/2')).toBeTruthy();
  });

  it('uses `${testIDPrefix}-${index}` as the Badge testID', () => {
    const { getByTestId } = render(
      <OnboardingTopRow
        current={3}
        total={5}
        index={0}
        count={2}
        testIDPrefix="onboarding-a2-fetus-index"
      />,
    );
    expect(getByTestId('onboarding-a2-fetus-index-0')).toBeTruthy();
  });

  it('omits the Badge testID when testIDPrefix is not provided', () => {
    const { queryByTestId } = render(
      <OnboardingTopRow current={0} total={5} index={0} count={2} />,
    );
    expect(queryByTestId('-0')).toBeNull();
  });
});
