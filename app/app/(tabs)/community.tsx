// 커뮤니티 탭 — PRD-009 의 메인 화면.
//
// 이 슬라이스의 범위:
//   - AC-009-03 상단 상태값: 현재 활성 아이 기준 "임신 20주차" / "생후 5개월".
//     아이를 전환하면 상태값과 피드가 함께 갱신된다. 사용자가 시기를 직접
//     고르는 필터는 1차 런치에서 제공하지 않는다(자동 추천만).
//   - AC-009-06 콘텐츠 타입 필터: 전체(기본) / 질문답변 / 자유일기.
//     거르는 주체는 서버다 — 커서 페이지네이션(ENG-009) 안에서 클라이언트가
//     다시 거르면 "이 페이지엔 없지만 다음 페이지엔 있는" 상태가 빈 화면으로
//     보인다.
//   - AC-009-13 중 커뮤니티 피드 3행: 공개 기록 0건 / 필터 결과 0건 /
//     네트워크 오류. 세 문구는 AC 표의 문자열 그대로다.
//
// 범위 밖(각각 후속 슬라이스):
//   - AC-009-04 오늘의 질문 카드(내 답변 상태 조회 경로가 아직 없다) →
//     화면 구조 ③이 비어 있다.
//   - AC-009-07 게시글 상세. 그래서 카드는 아직 탭해도 이동하지 않는다
//     (onPress 를 넘기지 않아 Pressable 이 button 역할조차 갖지 않는다).
//   - AC-009-08 공감 / AC-009-09 댓글 → 카드에 공감·댓글 수를 찍지 않는다.
//     likes/comments 테이블이 없어 0 을 찍으면 그것도 지어낸 값이다
//     (OtherEntryCard 주석의 같은 이유).
//   - ENG-011 유사 시기 가중 랭킹. 지금 정렬은 서버의 최신순(ENG-007)이다.
//
// 노출 풀·정렬·마스킹·50자 컷은 전부 서버가 끝내고 오므로 이 화면은 받은
// 것을 그대로 그린다.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_FEED_TYPE,
  getCommunityFeed,
  type CommunityFeedItem,
  type CommunityFeedType,
} from '../../src/api/community';
import { OtherEntryCard } from '../../src/components/OtherEntryCard';
import { Pill } from '../../src/components/Pill';
import { Text } from '../../src/components/Text';
import { useActiveChild } from '../../src/context/ActiveChildContext';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';
import { formatCommunityStageLabel } from '../../src/utils/communityStageLabel';

// AC-009-06 필터 항목. 순서·라벨은 AC 표 그대로(전체 → 질문답변 → 자유일기).
const FILTERS: { value: CommunityFeedType; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'question', label: '질문답변' },
  { value: 'diary', label: '자유일기' },
];

// AC-009-13 문구. 화면이 아니라 상수로 두어 테스트가 AC 표와 문자열을
// 직접 대조할 수 있게 한다.
const EMPTY_FEED_TEXT = '아직 공개된 기록이 없어요';
const EMPTY_FILTERED_TEXT = '해당 조건의 기록이 아직 없어요';
const ERROR_TEXT = '기록을 불러오지 못했어요. 다시 시도해주세요';

type FeedStatus = 'loading' | 'ready' | 'error';

export default function CommunityTab() {
  const { activeChild } = useActiveChild();
  const [filter, setFilter] = useState<CommunityFeedType>(DEFAULT_FEED_TYPE);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [entries, setEntries] = useState<CommunityFeedItem[]>([]);
  const [cursor, setCursor] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  // 활성 아이의 subject 가 노출 풀을 고른다(임신 case → 태아 기록, 육아
  // case → 아이 기록; ENG-008 케이스 혼합 금지). 그래서 아이를 바꾸면
  // 피드를 처음부터 다시 받는다 — AC-009-03 의 "전환 시 추천 기준 갱신".
  const subjectId = activeChild?.subjectId ?? null;

  // AC-009-03 상단 상태값. 홈 헤더와 포맷이 다른 이유는
  // utils/communityStageLabel.ts 주석 참고.
  const stageLabel = useMemo(() => {
    if (!activeChild) return null;
    return formatCommunityStageLabel(
      activeChild.kind,
      activeChild.dueOrBirthDate,
    );
  }, [activeChild]);

  // 첫 페이지: subject 나 필터가 바뀔 때마다 커서를 버리고 처음부터.
  useEffect(() => {
    if (!subjectId) {
      setStatus('ready');
      setEntries([]);
      setCursor('');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    getCommunityFeed({ subjectId, type: filter })
      .then((page) => {
        if (cancelled) return;
        setEntries(page.items);
        setCursor(page.nextCursor);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setCursor('');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId, filter]);

  // 다음 페이지(ENG-009 무한 스크롤). 커서가 비면 마지막 페이지라 아무것도
  // 하지 않는다. 추가 로드가 실패하면 이미 보이는 목록을 지우지 않고
  // 조용히 멈춘다 — 읽던 화면을 오류 문구로 갈아치우는 편이 더 나쁘다.
  const handleEndReached = useCallback(() => {
    if (!subjectId || !cursor || loadingMore || status !== 'ready') return;
    setLoadingMore(true);
    const requestedCursor = cursor;
    getCommunityFeed({ subjectId, type: filter, cursor: requestedCursor })
      .then((page) => {
        setEntries((prev) => [...prev, ...page.items]);
        setCursor(page.nextCursor);
      })
      .catch(() => {
        setCursor('');
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [subjectId, cursor, loadingMore, status, filter]);

  const notice =
    status === 'error'
      ? { text: ERROR_TEXT, testID: 'community-feed-error' }
      : status === 'ready' && entries.length === 0
        ? filter === DEFAULT_FEED_TYPE
          ? { text: EMPTY_FEED_TEXT, testID: 'community-feed-empty' }
          : { text: EMPTY_FILTERED_TEXT, testID: 'community-feed-empty-filtered' }
        : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']} testID="community-tab">
      {/* ① 상단 헤더 + ② 나와 비슷한 엄마들의 기록(상태값) — AC-009-02·03 */}
      <View style={styles.header}>
        <Text variant="h2" color="primary">
          커뮤니티
        </Text>
        {stageLabel ? (
          <Text
            variant="bodySmall"
            color="secondary"
            testID="community-stage-label"
          >
            {stageLabel} · 비슷한 시기의 기록
          </Text>
        ) : null}
      </View>

      {/* ④ 콘텐츠 타입 필터 — AC-009-06 */}
      <View style={styles.filterRow} testID="community-type-filter">
        {FILTERS.map((f) => (
          <Pill
            key={f.value}
            label={f.label}
            selected={filter === f.value}
            onPress={() => setFilter(f.value)}
            testID={`community-filter-${f.value}`}
          />
        ))}
      </View>

      {/* ⑤ 공개 기록 피드 */}
      {notice ? (
        <View style={styles.notice} testID={notice.testID}>
          <Text variant="bodySmall" color="muted">
            {notice.text}
          </Text>
        </View>
      ) : (
        <FlatList
          testID="community-feed-list"
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReachedThreshold={0.5}
          onEndReached={handleEndReached}
          renderItem={({ item }) => (
            <OtherEntryCard
              entry={item}
              showTypeBadge
              testID={`community-feed-entry-${item.id}`}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.cream,
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    gap: spacing[1],
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  listContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
  },
  separator: {
    height: spacing[2],
  },
  // 빈 상태·오류 상태의 자리. 카드와 같은 표면을 쓰되 내용은 문구 한 줄.
  notice: {
    marginHorizontal: spacing[5],
    marginTop: spacing[2],
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.md,
    padding: spacing[4],
    alignItems: 'center',
  },
});
