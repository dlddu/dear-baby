// DiaryCard — 일기 탭 목록 카드. M-36/M-37 의 시각: 좌상단 날짜, 우상단
// 아이 컨텍스트 칩 + 공개 배지, 본문은 Q · A 미리보기 1줄씩.

import { Pressable, StyleSheet, View } from 'react-native';

import type { RecordVisibility } from '../../api/types';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

import { ChildContextChip } from './ChildContextChip';
import { VisibilityBadge } from './VisibilityBadge';

export type DiaryCardProps = {
  dateLabel: string;
  childEmoji: string;
  childName: string;
  childContextLabel: string | null;
  visibility: RecordVisibility;
  question: string | null;
  answerPreview: string;
  onPress: () => void;
  testID?: string;
};

export function DiaryCard({
  dateLabel,
  childEmoji,
  childName,
  childContextLabel,
  visibility,
  question,
  answerPreview,
  onPress,
  testID,
}: DiaryCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={styles.headerRow}>
        <Text variant="micro" color="secondary" style={styles.date}>
          {dateLabel}
        </Text>
        <View style={styles.headerRight}>
          <ChildContextChip
            emoji={childEmoji}
            name={childName}
            contextLabel={childContextLabel}
          />
          <VisibilityBadge visibility={visibility} />
        </View>
      </View>
      {question ? (
        <Text
          variant="bodySmall"
          color="muted"
          numberOfLines={1}
          style={styles.question}
        >
          {`Q. ${question}`}
        </Text>
      ) : null}
      <Text
        variant="body"
        color="primary"
        numberOfLines={2}
        style={styles.answer}
      >
        {`A. ${answerPreview}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.md,
    padding: spacing[3],
    ...shadows.soft,
  },
  pressed: { opacity: 0.85 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  date: { paddingTop: 2 },
  headerRight: {
    alignItems: 'flex-end',
    gap: spacing[1],
  },
  question: { marginTop: spacing[2] },
  answer: { marginTop: spacing[1] },
});
