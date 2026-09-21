// 커뮤니티 탭 — PRD-009 의 메인 화면.
//
// **시각 출처: docs/mockups/source/src/screens/Community.tsx (M-43 · 커뮤니티 탭 메인).**
// 레포 스킬 `.claude/skills/screen-with-mockup-and-design-system` 이 요구하는 대로
// M-43 을 먼저 읽고 그 구조·카피·토큰을 1:1 로 옮겼다. M-43 의 화면 구조는
// AC-009-02 의 ①~⑤ 와 같은 순서다.
//
//   ① 상단 헤더            → CommunityHeader (M-43 L62-72)
//   ② 나와 비슷한 엄마들의 기록 → 본 파일의 similarStage 행 (M-43 L74-84)
//   ③ 오늘의 질문 카드      → **이번 슬라이스 범위 밖 (아래 이탈 1)**
//   ④ 콘텐츠 타입 필터      → CommunityTypeFilter (M-43 L131-146)
//   ⑤ 공개 기록 피드        → CommunityFeedCard (M-43 L148-153, L166-217)
//
// 이 슬라이스가 닫는 AC:
//   - AC-009-03 상단 상태값: 현재 활성 아이 기준 "임신 20주차" / "생후 5개월".
//     아이를 전환하면 상태값과 피드가 함께 갱신된다. M-43 이 이 값을 beige pill
//     에 `▼` 와 함께 그리지만 **`<div>` 로(=누를 수 없게)** 그렸고, AC-009-03 도
//     "1차 런치에서는 사용자가 직접 필터를 변경하는 기능을 제공하지 않는다" 이다.
//     그래서 여기서도 Pressable 이 아닌 View 다 — 글리프를 지우면 목업 이탈이고,
//     누를 수 있게 만들면 AC 위반이다.
//   - AC-009-06 콘텐츠 타입 필터: 전체(기본) / 질문답변 / 자유일기. 거르는 주체는
//     서버다 — 커서 페이지네이션(ENG-009) 안에서 클라이언트가 다시 거르면
//     "이 페이지엔 없지만 다음 페이지엔 있는" 상태가 빈 화면으로 보인다.
//   - AC-009-13 중 커뮤니티 피드 3행: 공개 기록 0건 / 필터 결과 0건 / 네트워크
//     오류. 세 문구는 AC 표의 문자열 그대로다. (M-43 에는 빈/예외 상태 목업이
//     없다 — PRD-009 "남은 후속 작업" 이 미작성으로 열거한 화면 중 하나다.)
//
// ── M-43 대비 이탈 (원인은 전부 데이터 부재) ─────────────────────────────────
//  1. **③ 오늘의 질문 카드 미구현.** AC-009-04 의 CTA 는 내 답변 상태로 3분기하는데
//     그중 "답변했고 공개 → 같은 질문 답변 모아보기 화면" 의 목적지가 화면·목업
//     모두 미작성이고(PRD-009 가 직접 열거), 레포 스킬 Step 3 이 목업 없는 화면
//     구현을 금지한다. 분기 판정에 필요한 "내 오늘 질문 답변 상태" 조회 경로도
//     없다 — records 는 `question_id` 가 아니라 `question_text` 만 갖는다.
//     카드만 그려 놓고 CTA 가 아무 데도 못 가면 그건 충족이 아니라 새 거짓말이다.
//  2. 피드 카드의 공감 수·댓글 수·자유일기 제목 — CommunityFeedCard 주석 참조.
//  3. 카드 탭 → 상세(AC-009-07) 이동 없음 — 상세 화면 미구현.
//
// 노출 풀·정렬·마스킹·50자 컷은 전부 서버가 끝내고 오므로(ENG-007~010, AC-009-10)
// 이 화면은 받은 것을 그대로 그린다.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getUnreadCount } from '../../src/api/notifications';
import {
  DEFAULT_FEED_TYPE,
  getCommunityFeed,
  type CommunityFeedItem,
  type CommunityFeedType,
} from '../../src/api/community';
import { CommunityFeedCard } from '../../src/components/CommunityFeedCard';
import { CommunityHeader } from '../../src/components/CommunityHeader';
import { CommunityTypeFilter } from '../../src/components/CommunityTypeFilter';
import { Text } from '../../src/components/Text';
import { useActiveChild } from '../../src/context/ActiveChildContext';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';
import { formatCommunityStageLabel } from '../../src/utils/communityStageLabel';

// M-43 ② 의 섹션 타이틀. 카피는 한 글자도 바꾸지 않는다.
const SIMILAR_STAGE_TITLE = '나와 비슷한 엄마들의 기록';
// M-43 의 stage pill 우측 글리프. 자동 추천 기준을 가리키는 표식일 뿐 조작
// 어포던스가 아니다 (AC-009-03 수동 필터 미제공).
const STAGE_PILL_GLYPH = '▼';

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
  const [unreadCount, setUnreadCount] = useState(0);

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

  // 헤더의 미읽음 dot — 일기 탭과 **같은 소스**를 쓴다. 커뮤니티 알림
  // (AC-009-12)은 1차 제외라 이 값은 공용 알림 스텁이며, 백엔드 알림 API 가
  // 도착하면 두 탭이 한 번에 따라온다.
  useEffect(() => {
    let cancelled = false;
    getUnreadCount()
      .then((n) => {
        if (!cancelled) setUnreadCount(n);
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      {/* ① 상단 헤더 — M-43 L62-72 */}
      <CommunityHeader hasUnreadNotification={unreadCount > 0} />

      {/* ② 나와 비슷한 엄마들의 기록 — M-43 L74-84 / AC-009-03 */}
      <View style={styles.similarStageRow}>
        <Text variant="h3Bold" color="primary" style={styles.similarStageTitle}>
          {SIMILAR_STAGE_TITLE}
        </Text>
        {stageLabel ? (
          <View style={styles.stagePill} testID="community-stage-pill">
            <Text
              variant="caption"
              color="primary"
              style={styles.stagePillText}
              testID="community-stage-pill-label"
            >
              {stageLabel}
            </Text>
            <Text style={styles.stagePillGlyph} color="secondary">
              {STAGE_PILL_GLYPH}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ③ 오늘의 질문 카드 — 이번 슬라이스 범위 밖 (파일 상단 이탈 1) */}

      {/* ④ 콘텐츠 타입 필터 — M-43 L131-146 / AC-009-06 */}
      <View style={styles.filterRow}>
        <CommunityTypeFilter value={filter} onChange={setFilter} />
      </View>

      {/* ⑤ 공개 기록 피드 — M-43 L148-153 */}
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
            <CommunityFeedCard
              entry={item}
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
  // M-43: px-5 pt-5 pb-3, justify-between, gap-3
  similarStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
  },
  similarStageTitle: { flexShrink: 1 },
  // M-43: bg-beige rounded-full px-3.5 py-2 gap-1.5, flex-shrink-0
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg.beige,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: spacing[2],
  },
  // M-43 의 pill 텍스트는 13px/semibold — caption(13/400) 위에 굵기만 얹는다.
  stagePillText: { fontWeight: '600' },
  stagePillGlyph: { fontSize: 10, lineHeight: 14 },
  // M-43: px-5 pb-3 (필터 컨테이너의 좌우 여백)
  filterRow: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  listContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
  },
  // M-43: space-y-3
  separator: {
    height: spacing[3],
  },
  // 빈 상태·오류 상태의 자리. M-43 에 대응 목업이 없어(빈/예외 상태 화면 미작성)
  // 피드 카드와 같은 표면을 쓰되 내용은 문구 한 줄로 둔다.
  notice: {
    marginHorizontal: spacing[5],
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.md,
    padding: spacing[4],
    alignItems: 'center',
  },
});
