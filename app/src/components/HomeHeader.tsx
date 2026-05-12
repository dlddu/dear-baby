// HomeHeader — PRD-007 AC-007-01·02·03 의 헤더 UI.
//
// 시각 출처: docs/mockups/source/src/screens/HomePregnancyScreen.tsx L19-41.
// 좌 화살표 · 중앙(활성 아이 displayName) · 우(화살표 + 종 + red dot) 의 3분할
// 헤더. 단일 아이면 좌·우 화살표가 흐림(opacity·비탭) 상태로 노출되고,
// 다자녀(>=2) 면 활성 상태가 된다. 종 우상단의 red dot 은 `hasUnread` 가
// true 일 때만 렌더.
//
// 데이터 주입은 호출자(home tab) 책임 — 본 컴포넌트는 ActiveChildContext 를
// 직접 의존하지 않고 props 만으로 동작하여 단위 테스트와 재사용을 단순화한다.

import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

import { Text } from './Text';

export type HomeHeaderProps = {
  displayName: string;
  canNavigate: boolean;
  hasUnreadNotification: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPressNotifications?: () => void;
  testID?: string;
};

const ARROW_HIT_SIZE = 32;

export function HomeHeader({
  displayName,
  canNavigate,
  hasUnreadNotification,
  onPrev,
  onNext,
  onPressNotifications,
  testID = 'home-header',
}: HomeHeaderProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        onPress={canNavigate ? onPrev : undefined}
        disabled={!canNavigate}
        accessibilityRole="button"
        accessibilityLabel="이전 아이"
        accessibilityState={{ disabled: !canNavigate }}
        hitSlop={8}
        style={[styles.arrowButton, !canNavigate && styles.arrowDisabled]}
        testID="home-header-prev"
      >
        <Text variant="body" color={canNavigate ? 'secondary' : 'muted'}>
          ◀
        </Text>
      </Pressable>

      <Text
        variant="h3"
        color="primary"
        numberOfLines={1}
        style={styles.name}
        testID="home-header-name"
      >
        {displayName}
      </Text>

      <View style={styles.rightGroup}>
        <Pressable
          onPress={canNavigate ? onNext : undefined}
          disabled={!canNavigate}
          accessibilityRole="button"
          accessibilityLabel="다음 아이"
          accessibilityState={{ disabled: !canNavigate }}
          hitSlop={8}
          style={[styles.arrowButton, !canNavigate && styles.arrowDisabled]}
          testID="home-header-next"
        >
          <Text variant="body" color={canNavigate ? 'secondary' : 'muted'}>
            ▶
          </Text>
        </Pressable>

        <Pressable
          onPress={onPressNotifications}
          accessibilityRole="button"
          accessibilityLabel={
            hasUnreadNotification
              ? '알림 (안 읽은 알림 있음)'
              : '알림'
          }
          hitSlop={8}
          style={styles.bellButton}
          testID="home-header-bell"
        >
          <Text variant="body" color="secondary" style={styles.bellGlyph}>
            🔔
          </Text>
          {hasUnreadNotification ? (
            <View style={styles.redDot} testID="home-header-unread-dot" />
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
  arrowButton: {
    width: ARROW_HIT_SIZE,
    height: ARROW_HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.35 },
  name: {
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: spacing[2],
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  bellButton: {
    width: ARROW_HIT_SIZE,
    height: ARROW_HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellGlyph: { fontSize: 18, lineHeight: 22 },
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
