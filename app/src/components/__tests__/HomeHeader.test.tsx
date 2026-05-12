// PRD-007 AC-007-02·03 — 헤더 화살표 활성/비활성 분기와 red dot 노출 잠금.
// TC-007-02-A (단일 아이 → 화살표 비활성), 02-B (다자녀 → 화살표 활성),
// 03 (red dot 표시/비표시) 를 단위 레벨에서 고정한다.

import { fireEvent, render } from '@testing-library/react-native';

import { HomeHeader } from '../HomeHeader';

describe('HomeHeader', () => {
  const defaultProps = {
    displayName: '콩이',
    canNavigate: false,
    hasUnreadNotification: false,
    onPrev: jest.fn(),
    onNext: jest.fn(),
  };

  it('renders the active child name in the center slot', () => {
    const { getByTestId } = render(<HomeHeader {...defaultProps} />);
    expect(getByTestId('home-header-name').props.children).toBe('콩이');
  });

  describe('TC-007-02-A — 단일 아이', () => {
    it('disables both arrows when canNavigate=false', () => {
      const onPrev = jest.fn();
      const onNext = jest.fn();
      const { getByTestId } = render(
        <HomeHeader
          {...defaultProps}
          canNavigate={false}
          onPrev={onPrev}
          onNext={onNext}
        />,
      );
      const prev = getByTestId('home-header-prev');
      const next = getByTestId('home-header-next');
      expect(prev.props.accessibilityState.disabled).toBe(true);
      expect(next.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(prev);
      fireEvent.press(next);
      expect(onPrev).not.toHaveBeenCalled();
      expect(onNext).not.toHaveBeenCalled();
    });
  });

  describe('TC-007-02-B — 다자녀', () => {
    it('enables both arrows when canNavigate=true and forwards taps', () => {
      const onPrev = jest.fn();
      const onNext = jest.fn();
      const { getByTestId } = render(
        <HomeHeader
          {...defaultProps}
          canNavigate
          onPrev={onPrev}
          onNext={onNext}
        />,
      );
      const prev = getByTestId('home-header-prev');
      const next = getByTestId('home-header-next');
      expect(prev.props.accessibilityState.disabled).toBe(false);
      expect(next.props.accessibilityState.disabled).toBe(false);
      fireEvent.press(prev);
      fireEvent.press(next);
      expect(onPrev).toHaveBeenCalledTimes(1);
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('TC-007-03 — 알림 red dot', () => {
    it('shows the red dot when hasUnreadNotification=true', () => {
      const { getByTestId } = render(
        <HomeHeader {...defaultProps} hasUnreadNotification />,
      );
      expect(getByTestId('home-header-unread-dot')).toBeTruthy();
    });

    it('hides the red dot when hasUnreadNotification=false', () => {
      const { queryByTestId } = render(
        <HomeHeader {...defaultProps} hasUnreadNotification={false} />,
      );
      expect(queryByTestId('home-header-unread-dot')).toBeNull();
    });

    it('invokes onPressNotifications when the bell is tapped', () => {
      const onPressNotifications = jest.fn();
      const { getByTestId } = render(
        <HomeHeader
          {...defaultProps}
          hasUnreadNotification
          onPressNotifications={onPressNotifications}
        />,
      );
      fireEvent.press(getByTestId('home-header-bell'));
      expect(onPressNotifications).toHaveBeenCalledTimes(1);
    });

    it('exposes an unread-aware accessibilityLabel on the bell', () => {
      const { getByTestId, rerender } = render(
        <HomeHeader {...defaultProps} hasUnreadNotification />,
      );
      expect(getByTestId('home-header-bell').props.accessibilityLabel).toBe(
        '알림 (안 읽은 알림 있음)',
      );
      rerender(
        <HomeHeader {...defaultProps} hasUnreadNotification={false} />,
      );
      expect(getByTestId('home-header-bell').props.accessibilityLabel).toBe(
        '알림',
      );
    });
  });
});
