// CommunityHeader — 커뮤니티 탭 전용 헤더. PRD-009 AC-009-02 ① 상단 헤더.
//
// 시각 출처: docs/mockups/source/src/screens/Community.tsx (M-43) L62-72.
//   좌 32×32 spacer · 중앙 "커뮤니티"(17px bold) · 우 🔔(+ 미읽음 coral dot),
//   하단 beige hairline.
//
// M-43 주석이 "탭 루트이므로 뒤로가기 없음 — 일기 탭 헤더(AC-008-10)와 동일
// 규칙" 이라 적었으므로 DiaryHeader 와 같은 형태를 따르되 필터 버튼만 없다.
// DiaryHeader 자체를 일반화하지 않는 이유: 그쪽은 M-36 이 시각 출처이고 지금
// 굵기(600)가 목업(700)과 어긋나 있는데, 그 이탈의 해소는 자매 모델
// `tbm_dear-baby-mockup-render` 소관이다. 여기서 공용 컴포넌트로 묶으면 일기
// 탭의 시각이 이 PR 의 부수효과로 함께 바뀐다.

import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

import { Text } from './Text';

const ICON_HIT_SIZE = 32;

export const COMMUNITY_HEADER_TITLE = '커뮤니티';

export type CommunityHeaderProps = {
  /** 미읽음 알림 존재 여부 — coral dot 노출 조건. */
  hasUnreadNotification: boolean;
  /**
   * 종 아이콘 탭. 커뮤니티 알림(AC-009-12)은 1차 런치 제외라 목적지가 없으며,
   * 홈·일기 탭과 마찬가지로 부모가 넘기지 않으면 아무 일도 하지 않는다.
   */
  onPressNotifications?: () => void;
  testID?: string;
};

export function CommunityHeader({
  hasUnreadNotification,
  onPressNotifications,
  testID = 'community-header',
}: CommunityHeaderProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.spacer} />
      <Text variant="h3Bold" color="primary" style={styles.title}>
        {COMMUNITY_HEADER_TITLE}
      </Text>
      <Pressable
        onPress={onPressNotifications}
        accessibilityRole="button"
        accessibilityLabel={
          hasUnreadNotification ? '알림 (안 읽은 알림 있음)' : '알림'
        }
        hitSlop={8}
        style={styles.iconButton}
        testID="community-header-bell"
      >
        <Text variant="body" color="secondary" style={styles.icon}>
          🔔
        </Text>
        {hasUnreadNotification ? (
          <View style={styles.redDot} testID="community-header-unread-dot" />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // M-43: px-5 pt-3 pb-3 + border-b border-beige/60
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bg.beige,
    backgroundColor: colors.bg.cream,
  },
  // M-43 의 좌측 `w-8 h-8` — 타이틀을 화면 정중앙에 두기 위한 균형추.
  spacer: { width: ICON_HIT_SIZE },
  title: { flex: 1, textAlign: 'center' },
  iconButton: {
    width: ICON_HIT_SIZE,
    height: ICON_HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18, lineHeight: 22 },
  // M-43: `absolute top-1 right-1 w-2 h-2 rounded-full bg-coral`
  redDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary.coral,
  },
});
