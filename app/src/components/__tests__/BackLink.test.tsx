// BackLink 컴포넌트 unit test — 온보딩 8개 화면이 공유하는 보조 [이전으로]
// 링크의 시각·동작 동등성을 잠가둔다.
//
// q1.test.tsx 와 동일한 패턴으로 react-native-safe-area-context 만 mock 하면
// 충분하다 (라우터·컨텍스트 의존 없음).

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

import { BackLink } from '../BackLink';

describe('BackLink', () => {
  it('renders default label "← 이전으로"', () => {
    const { getByText } = render(
      <BackLink onPress={() => {}} testID="back" />,
    );
    expect(getByText('← 이전으로')).toBeTruthy();
  });

  it('renders custom label when label prop is provided', () => {
    const { getByText, queryByText } = render(
      <BackLink onPress={() => {}} label="← 이전 아이로" testID="back" />,
    );
    expect(getByText('← 이전 아이로')).toBeTruthy();
    expect(queryByText('← 이전으로')).toBeNull();
  });

  it('invokes onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <BackLink onPress={onPress} testID="back" />,
    );
    fireEvent.press(getByTestId('back'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes accessibilityRole=button so screen readers treat it as a button', () => {
    const { getByTestId } = render(
      <BackLink onPress={() => {}} testID="back" />,
    );
    const node = getByTestId('back');
    expect(node.props.accessibilityRole).toBe('button');
  });

  it('uses the label as accessibilityLabel by default', () => {
    const { getByTestId } = render(
      <BackLink onPress={() => {}} label="← 이전 아이로" testID="back" />,
    );
    expect(getByTestId('back').props.accessibilityLabel).toBe('← 이전 아이로');
  });

  it('honors an explicit accessibilityLabel override', () => {
    const { getByTestId } = render(
      <BackLink
        onPress={() => {}}
        label="← 이전으로"
        accessibilityLabel="이전 화면으로 돌아가기"
        testID="back"
      />,
    );
    expect(getByTestId('back').props.accessibilityLabel).toBe(
      '이전 화면으로 돌아가기',
    );
  });
});
