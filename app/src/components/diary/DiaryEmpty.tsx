// DiaryEmpty — 일기 탭 빈 상태 (M-39). 일러스트(이모지), 카피, 홈 이동 CTA.
// 카피는 PRD-008 AC-008-09 명세 그대로: "아직 첫 기록이 없어요"

import { StyleSheet, View } from 'react-native';

import { Button } from '../Button';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

export type DiaryEmptyProps = {
  onGoHome: () => void;
};

export function DiaryEmpty({ onGoHome }: DiaryEmptyProps) {
  return (
    <View style={styles.container} testID="diary-empty">
      <View style={styles.iconBubble}>
        <Text style={styles.icon}>📓</Text>
      </View>
      <Text variant="h2Serif" color="primary" style={styles.title}>
        아직 첫 기록이 없어요
      </Text>
      <Text variant="caption" color="secondary" style={styles.subtitle}>
        홈에서 오늘의 질문에 답해보세요.{'\n'}한 마디면 충분해요.
      </Text>
      <View style={styles.cta}>
        <Button
          title="홈으로 가기"
          variant="primary"
          onPress={onGoHome}
          testID="diary-empty-go-home"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    paddingTop: spacing[8],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  iconBubble: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.primary.peach + '66', // 40% alpha
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
    ...shadows.soft,
  },
  icon: { fontSize: 44, lineHeight: 56 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: spacing[1] },
  cta: { marginTop: spacing[5] },
});
