// DiaryHeader — 일기 탭 전용 헤더. PRD-008 AC-008-10 의 명세대로 좌우 화살표
// 와 아이 이름이 없고, 가운데 "일기" 타이틀 + 우상단 알림 종 + 필터 버튼만
// 노출된다. 홈 헤더(HomeHeader)와 의도적으로 다른 시각이라 별도 컴포넌트로
// 둔다.

import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

const ICON_HIT_SIZE = 32;

export type DiaryHeaderProps = {
  hasUnreadNotification: boolean;
  hasActiveFilters: boolean;
  onPressNotifications?: () => void;
  onPressFilters: () => void;
  testID?: string;
};

export function DiaryHeader({
  hasUnreadNotification,
  hasActiveFilters,
  onPressNotifications,
  onPressFilters,
  testID = 'diary-header',
}: DiaryHeaderProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.spacer} />
      <Text variant="h3" color="primary" style={styles.title}>
        일기
      </Text>
      <View style={styles.rightGroup}>
        <Pressable
          onPress={onPressFilters}
          accessibilityRole="button"
          accessibilityLabel={hasActiveFilters ? '필터 (적용됨)' : '필터'}
          hitSlop={8}
          style={styles.iconButton}
          testID="diary-filter-open"
        >
          <Text variant="body" color="secondary" style={styles.icon}>
            ⚙️
          </Text>
          {hasActiveFilters ? (
            <View style={styles.filterDot} testID="diary-filter-active-dot" />
          ) : null}
        </Pressable>
        <Pressable
          onPress={onPressNotifications}
          accessibilityRole="button"
          accessibilityLabel={hasUnreadNotification ? '알림 (안 읽은 알림 있음)' : '알림'}
          hitSlop={8}
          style={styles.iconButton}
          testID="diary-header-bell"
        >
          <Text variant="body" color="secondary" style={styles.icon}>
            🔔
          </Text>
          {hasUnreadNotification ? (
            <View style={styles.redDot} testID="diary-header-unread-dot" />
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  spacer: { width: ICON_HIT_SIZE * 2 + spacing[2] },
  title: { flex: 1, textAlign: 'center' },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  iconButton: {
    width: ICON_HIT_SIZE,
    height: ICON_HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18, lineHeight: 22 },
  redDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary.coral,
  },
  filterDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary.coral,
  },
});
