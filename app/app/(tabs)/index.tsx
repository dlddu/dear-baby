import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AiPreviewCard } from '../../src/components/AiPreviewCard';
import { Button } from '../../src/components/Button';
import { Coachmark } from '../../src/components/Coachmark';
import { QuestionCard } from '../../src/components/QuestionCard';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthContext';
import { pickDailyQuestion } from '../../src/data/dailyQuestions';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { calcPregnancy } from '../../src/utils/pregnancy';

// HomeTab renders the Stage 2 of onboarding — voice-record coachmark + daily
// question card + dual CTAs + AI preview. See docs/design-system/
// onboarding.md for the spec. The AI preview starts blurred and unblurs
// after the user saves their first text record (drives `#가치선경험`).
// Voice recording itself is still out of scope (PRD-001); that CTA surfaces
// a "coming soon" alert until the audio pipeline lands.

const COACHMARK_LABEL = '🎙 말하기만 해도 기록이 돼요!';
const ENCOURAGEMENT = '첫 기록이 가장 소중해요 🌱';
const AI_PREVIEW_MOCK =
  '엄마가 너를 처음 느낀 그 순간, 세상이 조금 더 따뜻해졌어.';

export default function HomeTab() {
  const router = useRouter();
  const { user, dismissStage2Coachmark } = useAuth();
  // Local flag hides the coachmark immediately on tap; the backend call is
  // fire-and-forget so the UI never waits on the network. Persisted state
  // comes from `user.stage2_coachmark_dismissed_at` on next session load.
  const [coachmarkHidden, setCoachmarkHidden] = useState(false);

  const pregnancy = useMemo(
    () => calcPregnancy(user?.due_date ?? null),
    [user?.due_date],
  );
  const question = useMemo(() => pickDailyQuestion(), []);

  const showCoachmark =
    !coachmarkHidden && !user?.stage2_coachmark_dismissed_at;

  const handleDismissCoachmark = useCallback(() => {
    setCoachmarkHidden(true);
    // Swallow errors: a transient failure just means the coachmark will
    // appear again next cold boot, which is acceptable.
    void dismissStage2Coachmark().catch(() => {});
  }, [dismissStage2Coachmark]);

  const handleVoicePress = useCallback(() => {
    // Tapping the target element counts as engagement with the coachmark.
    if (showCoachmark) handleDismissCoachmark();
    Alert.alert('곧 추가됩니다', '음성 기록 기능은 준비 중이에요.');
  }, [showCoachmark, handleDismissCoachmark]);

  const handleTextPress = useCallback(() => {
    // Tapping the target element counts as engagement with the coachmark.
    if (showCoachmark) handleDismissCoachmark();
    router.push('/record-text');
  }, [router, showCoachmark, handleDismissCoachmark]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      testID="home-tab"
    >
      <QuestionCard
        weekLabel={pregnancy?.label ?? null}
        question={question}
        encouragement={ENCOURAGEMENT}
        testID="stage2-question-card"
        badgeTestID="stage2-week-badge"
      />

      {showCoachmark ? (
        <Coachmark
          label={COACHMARK_LABEL}
          onDismiss={handleDismissCoachmark}
          testID="stage2-coachmark"
          dismissTestID="stage2-coachmark-dismiss"
        />
      ) : null}

      <View style={styles.ctaRow}>
        <View style={styles.ctaItem}>
          <Button
            title="음성 기록"
            leading="🎙"
            variant="primary"
            fullWidth
            onPress={handleVoicePress}
            testID="stage2-voice-cta"
          />
        </View>
        <View style={styles.ctaItem}>
          <Button
            title="텍스트"
            leading="✏️"
            variant="secondary"
            fullWidth
            onPress={handleTextPress}
            testID="stage2-text-cta"
          />
        </View>
      </View>

      <AiPreviewCard
        mockText={AI_PREVIEW_MOCK}
        blurred={!user?.first_record_at}
        testID="stage2-ai-preview"
      />

      {user ? (
        <Text variant="caption" color="muted" style={styles.identity}>
          {user.name || user.email}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg.cream,
  },
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
    gap: spacing[5],
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  ctaItem: { flex: 1 },
  identity: { textAlign: 'center', marginTop: spacing[2] },
});
