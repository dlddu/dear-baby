// StepCard — Case B B0/B3 인트로 화면 전용 단계 카드.
// docs/mockups/source/src/screens/Onboarding.tsx M07_B0_Intro1·M10_B3_Intro2 의
// FrameCard 안 단계 행을 RN 으로 옮긴 것.
//
// 한 단계는 좌측 동그라미 아이콘 + 우측 라벨 한 줄로 구성된다. iconColor 로
// 단계 진행 톤(완료/현재/예정)을 표현한다 — sage(완료) / peach(현재) /
// coralTint(예정).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

import { Card } from './Card';
import { Text } from './Text';

export type StepCardItem = {
  /** 단계 번호 또는 이모지 (예: "1", "✓"). */
  glyph: string;
  /** 라벨 — "기존 아이 정보" 등. */
  label: string;
  /** 좌측 동그라미 배경 톤. */
  tone: 'sage' | 'peach' | 'coralTint';
};

export type StepCardProps = {
  items: StepCardItem[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const TONE_BG: Record<StepCardItem['tone'], string> = {
  // mockup 의 sage/30, peach/40, coral/20 과 톤 의도 동일 — RN 측에서는
  // alpha 대신 디자인 시스템의 sage/peach/coralTint 를 그대로 쓴다.
  sage: colors.accent.sage,
  peach: colors.primary.peach,
  coralTint: colors.primary.coralTint,
};

export function StepCard({ items, style, testID }: StepCardProps) {
  return (
    <Card padding="lg" style={[styles.card, style]} testID={testID}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <View
            key={`${item.glyph}-${i}`}
            style={[styles.row, !isLast && styles.rowDivider]}
          >
            <View
              style={[styles.glyphCircle, { backgroundColor: TONE_BG[item.tone] }]}
            >
              <Text variant="body" color="primary" style={styles.glyphText}>
                {item.glyph}
              </Text>
            </View>
            <Text variant="body" color="primary" style={styles.label}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.beige,
  },
  glyphCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphText: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
