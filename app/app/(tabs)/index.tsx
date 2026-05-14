// 홈 탭 — PRD-007 의 메인 화면.
//
// 본 작업(D) 범위:
//   - 1인칭 질문 카드(HomeQuestionCard) + 일일 3개 회전(AC-007-04·05)
//   - 음성/텍스트 모달 진입(AC-007-06) — 현재 회전 인덱스의 질문을 route
//     param 으로 전달
//   - 책 진행도(AC-007-07) — 활성 아이별 답변 수를 mock API 에서 받아
//     `n < 50` 은 진행 텍스트 + (?) 안내, `n >= 50` 은 "책 만들기" CTA →
//     자서전 탭으로 라우팅
//
// 회전 상태는 화면이 들고 있다 (당일 자정까지). 활성 아이가 바뀌면 자연스럽게
// 0번 질문부터 다시 보여지도록 인덱스를 리셋한다.
// 타인 기록 피드(AC-007-08·09) 는 카드 아래에 배치되며, mock 셀렉터가 정렬·
// 필터·비식별화·50자 컷을 처리한다.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTopThreeForHome, type FeedEntry } from '../../src/api/feed';
import { getUnreadCount } from '../../src/api/notifications';
import { getCountByActiveChild } from '../../src/api/recordsCount';
import { BookProgress } from '../../src/components/BookProgress';
import { HomeHeader } from '../../src/components/HomeHeader';
import { HomeQuestionCard } from '../../src/components/HomeQuestionCard';
import { OtherEntryCard } from '../../src/components/OtherEntryCard';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthContext';
import { useActiveChild } from '../../src/context/ActiveChildContext';
import { getDailyQuestionTriplet } from '../../src/data/dailyQuestions';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { formatChildAgeLabel, formatPregnancyLabel } from '../../src/utils/childLabel';

export default function HomeTab() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeChild, activeIndex, canNavigate, next, prev } = useActiveChild();
  // Unread notification count — backend is mocked (see api/notifications.ts).
  // Re-fetch on every focus so a future implementation can decrement when
  // the user returns from the notifications screen.
  const [unreadCount, setUnreadCount] = useState(0);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  // 책 진행도(AC-007-07): 활성 아이별 누적 답변 카운트. mock 가 결정적이라
  // 활성 아이 키만 의존성으로 두면 충분하다.
  const [recordsCount, setRecordsCount] = useState<number | null>(null);

  const triplet = useMemo(() => getDailyQuestionTriplet(), []);
  const activeQuestion = triplet[rotationIndex] ?? triplet[0] ?? '';

  // 활성 아이가 바뀌면 회전 인덱스도 0번으로 리셋 — 다자녀 사용자가 새 아이의
  // 첫 질문부터 보도록 한다.
  useEffect(() => {
    setRotationIndex(0);
  }, [activeIndex]);

  // 활성 아이가 바뀌면 진행도 카운트도 재페치. mock 가 결정적이라 키
  // (kind, ordinal) 만 의존성이면 충분 — context 의 activeChild 객체는 매
  // 렌더마다 새 참조가 될 수 있어서 그대로 의존성에 두면 의도치 않은 재페치가
  // 일어난다.
  const activeKind = activeChild?.kind ?? null;
  const activeOrdinal = activeChild?.ordinal ?? null;
  useEffect(() => {
    if (!activeKind || activeOrdinal == null) {
      setRecordsCount(null);
      return;
    }
    let cancelled = false;
    void getCountByActiveChild({
      kind: activeKind,
      ordinal: activeOrdinal,
    }).then((n) => {
      if (!cancelled) setRecordsCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [activeKind, activeOrdinal]);

  // 컨텍스트 라벨: 임신 모드는 D-day/주차, 양육 모드는 개월/나이 + 일째.
  // 표시 이름은 활성 아이의 displayName 을 우선하고, 활성 아이가 아직 비어 있는
  // 호환 경로에서는 user.name 으로 폴백한다.
  const contextLabel = useMemo(() => {
    if (!activeChild) return null;
    if (activeChild.kind === 'fetus') {
      return formatPregnancyLabel(activeChild.dueOrBirthDate);
    }
    return formatChildAgeLabel(activeChild.dueOrBirthDate);
  }, [activeChild]);

  const weekLabel = useMemo(() => {
    if (!activeChild || activeChild.kind !== 'fetus') return '';
    return formatPregnancyLabel(activeChild.dueOrBirthDate) ?? '';
  }, [activeChild]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getUnreadCount().then((n) => {
        if (!cancelled) setUnreadCount(n);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // 피드는 마운트 시 한 번만 — mock 이라 결정적이고, 포커스마다 다시 셔플할
  // 이유가 없다. 백엔드 도착 후 정렬·페이지네이션 정책에 맞춰 재검토.
  useEffect(() => {
    let cancelled = false;
    void getTopThreeForHome().then((entries) => {
      if (!cancelled) setFeedEntries(entries);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePrevQuestion = useCallback(() => {
    setRotationIndex((curr) => (curr > 0 ? curr - 1 : curr));
  }, []);

  const handleNextQuestion = useCallback(() => {
    setRotationIndex((curr) =>
      curr < triplet.length - 1 ? curr + 1 : curr,
    );
  }, [triplet.length]);

  // 기록 화면 진입 시 활성 아이 (kind, ordinal) 을 라우팅 params 로 동봉한다.
  // 자식 화면이 context 를 직접 구독하지 않게 해 iOS 스와이프 백 함정을 피한다
  // (CLAUDE.md 참고). activeChild 가 null 인 호환 경로에서는 라우팅을 막아
  // child 정보 없는 기록 작성을 방지한다.
  const handleVoicePress = useCallback(() => {
    if (!activeKind || activeOrdinal == null) return;
    router.push({
      pathname: '/record-audio',
      params: {
        question: activeQuestion,
        week_label: weekLabel,
        child_kind: activeKind,
        child_ordinal: String(activeOrdinal),
      },
    });
  }, [router, activeQuestion, weekLabel, activeKind, activeOrdinal]);

  const handleTextPress = useCallback(() => {
    if (!activeKind || activeOrdinal == null) return;
    router.push({
      pathname: '/record-text',
      params: {
        question: activeQuestion,
        week_label: weekLabel,
        child_kind: activeKind,
        child_ordinal: String(activeOrdinal),
      },
    });
  }, [router, activeQuestion, weekLabel, activeKind, activeOrdinal]);

  const handleFeedMorePress = useCallback(() => {
    router.push('/(tabs)/community');
  }, [router]);

  // (?) 안내 — PRD-007 후속 검토 항목이라 카피는 잠정. 디자인 시스템 모달이
  // 도착하면 핸들러만 교체하면 되도록 BookProgress 외부에서 Alert 를 띄운다.
  const handleProgressHelp = useCallback(() => {
    Alert.alert(
      '책 진행도 안내',
      '50개의 답변이 모이면 아이에게 전해줄 책을 만들 수 있어요.',
    );
  }, []);

  // n>=50 도달 시 "책 만들기" CTA — 자서전 탭으로 라우팅. 작업 A 에서 추가된
  // (tabs)/memoir 가 destination 이다.
  const handleProgressCta = useCallback(() => {
    router.push('/(tabs)/memoir');
  }, [router]);

  const displayName = activeChild?.displayName ?? user?.name ?? '우리 아이';

  return (
    <SafeAreaView style={styles.screen} edges={['top']} testID="home-tab">
      <HomeHeader
        displayName={displayName}
        canNavigate={canNavigate}
        hasUnreadNotification={unreadCount > 0}
        onPrev={prev}
        onNext={next}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
      >
        <HomeQuestionCard
          profileImageUrl={activeChild?.profileImageUrl ?? null}
          displayName={displayName}
          contextLabel={contextLabel}
          questions={triplet}
          currentIndex={rotationIndex}
          onPrev={handlePrevQuestion}
          onNext={handleNextQuestion}
          onPressVoice={handleVoicePress}
          onPressText={handleTextPress}
          footer={
            recordsCount !== null ? (
              <BookProgress
                count={recordsCount}
                onPressHelp={handleProgressHelp}
                onPressCta={handleProgressCta}
              />
            ) : undefined
          }
        />

        {feedEntries.length > 0 ? (
          <View style={styles.feedSection} testID="home-feed-section">
            <View style={styles.feedHeader}>
              <Text variant="sectionTitle" color="primary">
                다른 엄마들의 기록
              </Text>
              <Pressable
                onPress={handleFeedMorePress}
                accessibilityRole="button"
                accessibilityLabel="다른 엄마들의 기록 더보기"
                hitSlop={6}
                style={styles.feedMore}
                testID="home-feed-more"
              >
                <Text variant="bodySmall" color="secondary">
                  더보기 ›
                </Text>
              </Pressable>
            </View>
            <View style={styles.feedList}>
              {feedEntries.map((entry) => (
                <OtherEntryCard
                  key={entry.id}
                  entry={entry}
                  testID={`home-feed-entry-${entry.id}`}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.cream,
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
    gap: spacing[5],
  },
  feedSection: {
    gap: spacing[2],
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedMore: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[1],
  },
  feedList: {
    gap: spacing[2],
  },
});
