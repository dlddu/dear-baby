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
// 타인 기록 피드는 PRD-009 AC-009-14("다른 엄마들의 기록" 섹션, 구 AC-007-08
// 에서 이관) 로, `GET /v1/community/feed` 의 결과를 최대 3개 카드로 그린다.
// 정렬·노출 풀·마스킹·50자 컷은 모두 서버가 끝내고 오므로 화면은 받은 것을
// 그대로 렌더한다. 0건·오류 시의 문구는 AC-009-13 의 홈 관련 두 행을 따른다.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getTopThreeForHome,
  type CommunityFeedItem,
} from '../../src/api/community';
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
import { radius } from '../../src/theme/radius';
import { shadows } from '../../src/theme/shadows';
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
  // 피드는 로딩·성공·실패 세 갈래를 구분해야 한다 — 빈 배열 하나로는
  // "아직 안 왔다" 와 "공개 기록이 0건이다"(AC-009-13 빈 카드) 를 구분할 수
  // 없고, 실패를 0건으로 그리면 사용자에게 거짓말이 된다.
  const [feedStatus, setFeedStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [feedEntries, setFeedEntries] = useState<CommunityFeedItem[]>([]);
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

  // 활성 아이가 정해져야 피드를 부를 수 있다 — subject 의 kind 가 노출 풀을
  // 고르기 때문(임신 case 는 태아 기록, 육아 case 는 아이 기록; ENG-008 케이스
  // 혼합 금지). 그래서 아이를 바꾸면 피드도 다시 받는다.
  const feedSubjectId = activeChild?.subjectId ?? null;
  useEffect(() => {
    if (!feedSubjectId) {
      setFeedStatus('ready');
      setFeedEntries([]);
      return;
    }
    let cancelled = false;
    setFeedStatus('loading');
    getTopThreeForHome(feedSubjectId)
      .then((entries) => {
        if (cancelled) return;
        setFeedEntries(entries);
        setFeedStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setFeedEntries([]);
        setFeedStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [feedSubjectId]);

  const handlePrevQuestion = useCallback(() => {
    setRotationIndex((curr) => (curr > 0 ? curr - 1 : curr));
  }, []);

  const handleNextQuestion = useCallback(() => {
    setRotationIndex((curr) =>
      curr < triplet.length - 1 ? curr + 1 : curr,
    );
  }, [triplet.length]);

  const handleVoicePress = useCallback(() => {
    router.push({
      pathname: '/record-audio',
      params: { question: activeQuestion, week_label: weekLabel },
    });
  }, [router, activeQuestion, weekLabel]);

  const handleTextPress = useCallback(() => {
    router.push({
      pathname: '/record-text',
      params: { question: activeQuestion, week_label: weekLabel },
    });
  }, [router, activeQuestion, weekLabel]);

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

        {feedSubjectId ? (
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
            {/* 로딩 중에는 아무 카드도 그리지 않는다 — 빈 상태 문구를 잠깐
                보여줬다가 카드로 바뀌는 깜빡임이 더 나쁘다. */}
            {feedStatus === 'error' ? (
              <View style={styles.feedNotice} testID="home-feed-error">
                <Text variant="bodySmall" color="muted">
                  기록을 불러오지 못했어요. 다시 시도해주세요
                </Text>
              </View>
            ) : feedStatus === 'ready' && feedEntries.length === 0 ? (
              // AC-009-13·14 — 공개 기록이 0건이면 mock 대신 빈 카드 + CTA.
              <Pressable
                onPress={handleTextPress}
                accessibilityRole="button"
                style={styles.feedNotice}
                testID="home-feed-empty"
              >
                <Text
                  variant="bodySmall"
                  color="secondary"
                  testID="home-feed-empty-cta"
                >
                  첫 기록을 공개해보세요
                </Text>
              </Pressable>
            ) : (
              <View style={styles.feedList}>
                {feedEntries.map((entry) => (
                  <OtherEntryCard
                    key={entry.id}
                    entry={entry}
                    testID={`home-feed-entry-${entry.id}`}
                  />
                ))}
              </View>
            )}
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
  // 빈 상태·오류 상태의 자리. 카드와 같은 표면을 쓰되 내용만 문구 한 줄이라
  // 섹션이 통째로 사라지지 않고 "여기에 무언가 올 자리" 라는 게 남는다.
  feedNotice: {
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.md,
    padding: spacing[4],
    alignItems: 'center',
    ...shadows.card,
  },
});
