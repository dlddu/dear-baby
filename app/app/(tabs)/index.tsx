// 홈 탭 — PRD-007 의 메인 화면.
//
// 본 작업(C) 범위:
//   - 1인칭 질문 카드(HomeQuestionCard) + 일일 3개 회전(AC-007-04·05)
//   - 음성/텍스트 모달 진입(AC-007-06) — 현재 회전 인덱스의 질문을 route
//     param 으로 전달
//
// 회전 상태는 화면이 들고 있다 (당일 자정까지). 활성 아이가 바뀌면 자연스럽게
// 0번 질문부터 다시 보여지도록 인덱스를 리셋한다.
// 책 진행도(AC-007-07)·피드(AC-007-08) 는 후속 작업(D·E) 에서 추가된다.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getUnreadCount } from '../../src/api/notifications';
import { HomeHeader } from '../../src/components/HomeHeader';
import { HomeQuestionCard } from '../../src/components/HomeQuestionCard';
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

  const triplet = useMemo(() => getDailyQuestionTriplet(), []);
  const activeQuestion = triplet[rotationIndex] ?? triplet[0] ?? '';

  // 활성 아이가 바뀌면 회전 인덱스도 0번으로 리셋 — 다자녀 사용자가 새 아이의
  // 첫 질문부터 보도록 한다.
  useEffect(() => {
    setRotationIndex(0);
  }, [activeIndex]);

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
        />
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
});
