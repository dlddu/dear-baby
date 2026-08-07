// OtherEntryCard — PRD-009 AC-009-14 의 홈 "다른 엄마들의 기록" 피드 카드.
//   (구 PRD-007 AC-007-08 에서 2026-08-05 이관.)
//
// 시각 출처: docs/mockups/source/src/screens/HomePregnancyScreen.tsx L114-129.
// 카드 구성:
//   - 좌상단: 마스킹 표시명 (AC-009-10, 예: 'seo***1') + 작성 당시 아이 현황
//     ('임신 20주차'). 현황은 서버가 산출하지 못하면 빈 문자열로 오고, 그때는
//     줄을 아예 그리지 않는다 (없는 값을 지어내지 않는다).
//   - 본문: 질문 (h3, ink — AI 질문 답변일 때만) + 미리보기 ('…' 마커는 muted)
//
// **공감 수(♥)는 아직 그리지 않는다.** AC-009-14 는 카드에 공감 수를 요구하지만
// likes 테이블·집계가 없어 실제 값을 낼 수 없다. 0 이나 임의 값을 박으면 이
// 화면이 오래 해 온 일(mock 데이터 노출)을 되풀이하는 셈이라, AC-009-08(공감)
// 슬라이스가 실제 카운트를 실어 올 때 이 카드에 다시 붙인다.
//
// preview 는 서버가 이미 50자로 자르고 '…' 를 붙여 보낸다. 본 컴포넌트는 그
// 마커를 muted 색으로 분리해 칠할 뿐, 자체 추가 자르기는 하지 않는다.
//
// `showTypeBadge` 는 커뮤니티 탭(AC-009-02 카드의 "콘텐츠 타입" 요소)만
// 켜는 opt-in 이다. 홈(AC-009-14)의 카드 요소 목록에는 타입 표시가 없어
// 기본값 false 로 두었다 — 홈 렌더 결과는 이 prop 도입 전후로 동일하다.
// 타입은 `questionText` 유무에서 그대로 나오므로(서버의 질문답변/자유일기
// 판정과 같은 근거) 새로 지어내는 값이 아니다.

import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { CommunityFeedItem } from '../api/community';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';

import { Text } from './Text';

export type OtherEntryCardProps = {
  entry: CommunityFeedItem;
  /** 카드 탭 — 게시글 상세(AC-009-07)가 도착하기 전까지 부모가 noop 으로 둔다. */
  onPress?: () => void;
  /** AC-009-02 카드의 "콘텐츠 타입" 배지. 홈은 끄고 커뮤니티 탭만 켠다. */
  showTypeBadge?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// 서버가 붙인 '…' 마커. 본 컴포넌트는 이 한 글자를 muted 색으로 분리해
// 칠하기 위해서만 안다.
const ELLIPSIS_MARKER = '…';

export function OtherEntryCard({
  entry,
  onPress,
  showTypeBadge = false,
  style,
  testID = 'other-entry-card',
}: OtherEntryCardProps) {
  const hasEllipsis = entry.preview.endsWith(ELLIPSIS_MARKER);
  const previewBody = hasEllipsis
    ? entry.preview.slice(0, -ELLIPSIS_MARKER.length)
    : entry.preview;

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
            {entry.authorName}
          </Text>
          {entry.childStatusText ? (
            <Text
              variant="micro"
              color="muted"
              style={styles.context}
              numberOfLines={1}
              testID={`${testID}-context`}
            >
              {entry.childStatusText}
            </Text>
          ) : null}
        </View>
      </View>

      {showTypeBadge ? (
        <Text
          variant="micro"
          color="coral"
          style={styles.typeBadge}
          testID={`${testID}-type`}
        >
          {entry.questionText ? '질문답변' : '자유일기'}
        </Text>
      ) : null}

      {entry.questionText ? (
        <Text
          variant="cardTitle"
          color="primary"
          style={styles.question}
          testID={`${testID}-question`}
        >
          {entry.questionText}
        </Text>
      ) : null}

      <Text
        variant="bodySmall"
        color="secondary"
        style={styles.answer}
        testID={`${testID}-answer`}
      >
        {previewBody}
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
  typeBadge: {
    marginTop: spacing[1],
  },
  question: {
    marginTop: spacing[1],
  },
  answer: {
    marginTop: spacing[1],
  },
});
