// CommunityFeedCard — PRD-009 AC-009-02 의 커뮤니티 피드 카드.
//
// 시각 출처: docs/mockups/source/src/screens/Community.tsx (M-43) L166-217 `FeedCard`.
//   카드:    `bg-ivory rounded-db-md shadow-db-sm px-4 py-4`
//   메타행:  `mb-2.5` — 표시명 14/bold ink · 아이 현황 12 ink-muted (· ❤️ 공감 수)
//   제목행:  15/bold ink `leading-[1.45]` `mb-1.5` — 질문답변이면 질문 텍스트,
//            자유일기면 `bg-peach/35 rounded-db-xs` 인라인 배지
//   본문:    13 ink-sub `leading-[1.7]` `whitespace-pre-line` (· 💬 댓글 수)
//
// **홈의 `OtherEntryCard` 와 합치지 않는다.** 두 카드는 시각 출처가 다르다 —
// 홈(AC-009-14)은 M-17 `HomePregnancyScreen.tsx` L114-129, 커뮤니티는 M-43 이다.
// 한 컴포넌트가 두 목업을 섬기면 어느 쪽도 목업과 대조할 수 없다.
//
// ── M-43 대비 이탈 (전부 원인이 데이터 부재다) ───────────────────────────────
//  1. **공감 수(❤️ + 카운트) 미표시** — likes 테이블·집계가 없다(AC-009-08 미구현).
//     0 을 찍으면 이 화면이 오래 해 온 mock 노출을 되풀이하는 것이다.
//  2. **댓글 수(💬 댓글 N) 미표시** — comments 테이블이 없다(AC-009-09 미구현).
//  3. **자유일기의 제목 미표시** — `records` 에 title 컬럼 자체가 없다. 그래서
//     자유일기 카드의 제목행에는 타입 배지만 남는다. 질문답변은 질문 텍스트가
//     그 자리를 채우므로 영향이 없다.
//  4. **카드 탭 → 상세 이동 없음** — AC-009-07 상세 화면 미구현. M-43 도 정적
//     `<div>` 라 시각 이탈은 아니며, 상세가 도착하면 이 카드를 Pressable 로 감싼다.
//
// 배지 글자 크기는 목업 11px 이 아니라 `docs/design-system/components.md` 의
// Badges 규정(12px/600 = `badge` 토큰)을 따랐다 — 목업과 디자인 시스템이 어긋날
// 때는 디자인 시스템이 정본이다.
//
// preview 는 서버가 이미 50자로 자르고 '…' 를 붙여 보낸다. 본 컴포넌트는 그
// 마커를 muted 색으로 분리해 칠할 뿐, 자체 추가 자르기는 하지 않는다.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { CommunityFeedItem } from '../api/community';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';

import { Text } from './Text';

// 서버가 붙인 '…' 마커. 이 한 글자를 muted 색으로 분리해 칠하기 위해서만 안다.
const ELLIPSIS_MARKER = '…';

// AC-009-06 의 `자유일기` 와 같은 어휘 — 필터 라벨과 배지가 어긋나면 사용자가
// 같은 것을 두 이름으로 배운다.
export const DIARY_BADGE_LABEL = '자유일기';

export type CommunityFeedCardProps = {
  entry: CommunityFeedItem;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CommunityFeedCard({
  entry,
  style,
  testID = 'community-feed-card',
}: CommunityFeedCardProps) {
  const hasEllipsis = entry.preview.endsWith(ELLIPSIS_MARKER);
  const previewBody = hasEllipsis
    ? entry.preview.slice(0, -ELLIPSIS_MARKER.length)
    : entry.preview;

  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={styles.metaRow}>
        <Text
          variant="sectionTitle"
          color="primary"
          numberOfLines={1}
          testID={`${testID}-alias`}
        >
          {entry.authorName}
        </Text>
        {entry.childStatusText ? (
          <Text
            variant="bodySmall"
            color="muted"
            style={styles.stage}
            numberOfLines={1}
            testID={`${testID}-stage`}
          >
            {entry.childStatusText}
          </Text>
        ) : null}
      </View>

      <View style={styles.titleRow}>
        {entry.questionText ? (
          <Text
            variant="feedTitle"
            color="primary"
            testID={`${testID}-question`}
          >
            {entry.questionText}
          </Text>
        ) : (
          <View style={styles.typeBadge} testID={`${testID}-type-badge`}>
            <Text variant="badge" color="primary">
              {DIARY_BADGE_LABEL}
            </Text>
          </View>
        )}
      </View>

      <Text variant="feedBody" color="secondary" testID={`${testID}-preview`}>
        {previewBody}
        {hasEllipsis ? (
          <Text variant="feedBody" color="muted">
            {ELLIPSIS_MARKER}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.md,
    padding: spacing[4],
    ...shadows.card,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    // M-43 의 `mb-2.5` = 10px — 4의 배수가 아니라 spacing 토큰에 없다.
    marginBottom: 10,
  },
  stage: { flexShrink: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // M-43 의 `mb-1.5` = 6px.
    marginBottom: 6,
  },
  typeBadge: {
    backgroundColor: colors.primary.peachTint,
    borderRadius: radius.xs,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
});
