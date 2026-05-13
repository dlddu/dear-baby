// OtherEntryCard — PRD-007 AC-007-08 의 타인 기록 피드 카드.
//
// 시각 출처: docs/mockups/source/src/screens/HomePregnancyScreen.tsx L114-129.
// 카드 구성:
//   - 좌상단: 비식별화 alias (예: 'cho***3') + 아이 컨텍스트 ('임신 3주차')
//   - 우상단: ♥ + 카운트 (coral)
//   - 본문: 질문 (h3, ink) + 답변 snippet ('…' 마커는 muted)
//
// answer 는 이미 셀렉터가 잘라 '…' 까지 붙여 넘긴다고 가정한다. 본 컴포넌트
// 는 마커를 다시 분리해 muted 색으로만 칠할 뿐, 자체 추가 자르기는 하지
// 않는다 — UI 에서 글자 수를 만지려면 셀렉터 한도(FEED_ANSWER_SNIPPET_LIMIT)
// 부터 조정한다.

import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { FeedEntry } from '../api/feed';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';

import { Text } from './Text';

export type OtherEntryCardProps = {
  entry: FeedEntry;
  /** 카드 탭 — 본 작업 범위에서는 부모가 noop 으로 둘 수 있다. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// 셀렉터가 붙인 '…' 마커. 본 컴포넌트는 이 한 글자를 muted 색으로 분리해
// 칠하기 위해서만 안다.
const ELLIPSIS_MARKER = '…';

export function OtherEntryCard({
  entry,
  onPress,
  style,
  testID = 'other-entry-card',
}: OtherEntryCardProps) {
  const hasEllipsis = entry.answer.endsWith(ELLIPSIS_MARKER);
  const answerBody = hasEllipsis
    ? entry.answer.slice(0, -ELLIPSIS_MARKER.length)
    : entry.answer;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[styles.card, style]}
      testID={testID}
    >
      <View style={styles.headerRow}>
        <View style={styles.identityRow}>
          <Text
            variant="aliasStrong"
            color="primary"
            style={styles.alias}
            numberOfLines={1}
            testID={`${testID}-alias`}
          >
            {entry.authorAlias}
          </Text>
          <Text
            variant="micro"
            color="muted"
            style={styles.context}
            numberOfLines={1}
            testID={`${testID}-context`}
          >
            {entry.childContext}
          </Text>
        </View>
        <View style={styles.heartRow}>
          <Text variant="micro" color="coral" style={styles.heartGlyph}>
            ♥
          </Text>
          <Text
            variant="micro"
            color="coral"
            style={styles.heartCount}
            testID={`${testID}-hearts`}
          >
            {entry.heartCount}
          </Text>
        </View>
      </View>

      <Text
        variant="cardTitle"
        color="primary"
        style={styles.question}
        testID={`${testID}-question`}
      >
        {entry.question}
      </Text>

      <Text
        variant="bodySmall"
        color="secondary"
        style={styles.answer}
        testID={`${testID}-answer`}
      >
        {answerBody}
        {hasEllipsis ? (
          <Text variant="bodySmall" color="muted">
            {ELLIPSIS_MARKER}
          </Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.md,
    padding: spacing[3],
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2],
    flex: 1,
    minWidth: 0,
  },
  alias: {},
  context: {
    flexShrink: 1,
  },
  heartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  heartGlyph: {},
  heartCount: {},
  question: {
    marginTop: spacing[1],
  },
  answer: {
    marginTop: spacing[1],
  },
});
