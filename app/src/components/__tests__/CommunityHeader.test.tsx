// CommunityHeader — M-43 ① 상단 헤더.
//
// 탭 루트라 뒤로가기가 없고, 좌측 spacer 로 타이틀을 정중앙에 둔다. 미읽음
// 여부가 coral dot 의 유무를 가른다.

import { fireEvent, render } from '@testing-library/react-native';

import {
  COMMUNITY_HEADER_TITLE,
  CommunityHeader,
} from '../CommunityHeader';

describe('CommunityHeader', () => {
  it('목업 카피 그대로 "커뮤니티" 를 그린다', () => {
    expect(COMMUNITY_HEADER_TITLE).toBe('커뮤니티');
    const { getByText } = render(
      <CommunityHeader hasUnreadNotification={false} />,
    );
    expect(getByText('커뮤니티')).toBeTruthy();
  });

  it('미읽음이 있으면 dot 을 띄우고 접근성 라벨로도 알린다', () => {
    const { getByTestId } = render(
      <CommunityHeader hasUnreadNotification />,
    );
    expect(getByTestId('community-header-unread-dot')).toBeTruthy();
    expect(
      getByTestId('community-header-bell').props.accessibilityLabel,
    ).toBe('알림 (안 읽은 알림 있음)');
  });

  it('미읽음이 없으면 dot 이 없다', () => {
    const { queryByTestId, getByTestId } = render(
      <CommunityHeader hasUnreadNotification={false} />,
    );
    expect(queryByTestId('community-header-unread-dot')).toBeNull();
    expect(
      getByTestId('community-header-bell').props.accessibilityLabel,
    ).toBe('알림');
  });

  it('종을 누르면 onPressNotifications 가 불린다', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <CommunityHeader hasUnreadNotification onPressNotifications={onPress} />,
    );
    fireEvent.press(getByTestId('community-header-bell'));
    expect(onPress).toHaveBeenCalled();
  });

  // 탭 루트에는 뒤로가기가 없다 (M-43 주석: "원본 기획 이미지에는 ◀ 가 있었으나
  // 탭 루트 규칙을 따라 제거했다").
  it('뒤로가기 버튼이 없다', () => {
    const { queryByText } = render(
      <CommunityHeader hasUnreadNotification={false} />,
    );
    expect(queryByText('◀')).toBeNull();
  });
});
