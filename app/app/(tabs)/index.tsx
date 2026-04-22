import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import {
  AiPreviewCard,
  type AiPreviewStatus,
} from '../../src/components/AiPreviewCard';
import { Button } from '../../src/components/Button';
import { Coachmark } from '../../src/components/Coachmark';
import { QuestionCard } from '../../src/components/QuestionCard';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthContext';
import { openAiPreviewStream, requestAiPreview } from '../../src/api/ai';
import { pickDailyQuestion } from '../../src/data/dailyQuestions';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { calcPregnancy } from '../../src/utils/pregnancy';

// HomeTab renders Stage 2 of onboarding — coachmark + question card + dual
// CTAs + AI preview. The home screen owns Stage 2's state transitions end
// to end: first-record detection, AI preview kickoff, SSE subscription,
// loading/ready/failed handoff. AuthContext stays record-agnostic.

const COACHMARK_LABEL = '🎙 말하기만 해도 기록이 돼요!';
const ENCOURAGEMENT = '첫 기록이 가장 소중해요 🌱';

export default function HomeTab() {
  const router = useRouter();
  const { user, dismissVoiceCoachmark, applyAiPreview } = useAuth();
  // Local flag hides the coachmark immediately on tap; the backend call is
  // fire-and-forget so the UI never waits on the network.
  const [coachmarkHidden, setCoachmarkHidden] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const prevFirstRecordAtRef = useRef<string | null>(
    user?.first_record_at ?? null,
  );

  const pregnancy = useMemo(
    () => calcPregnancy(user?.due_date ?? null),
    [user?.due_date],
  );
  const question = useMemo(() => pickDailyQuestion(), []);

  // Coachmark auto-hides after the first record. Once first_record_at is
  // stamped the tooltip has served its purpose; keeping it would clutter
  // the preview flow.
  const showCoachmark =
    !coachmarkHidden &&
    !user?.voice_coachmark_dismissed_at &&
    !user?.first_record_at;

  const handleDismissCoachmark = useCallback(() => {
    setCoachmarkHidden(true);
    void dismissVoiceCoachmark().catch(() => {});
  }, [dismissVoiceCoachmark]);

  const handleVoicePress = useCallback(() => {
    if (showCoachmark) handleDismissCoachmark();
    Alert.alert('곧 추가됩니다', '음성 기록 기능은 준비 중이에요.');
  }, [showCoachmark, handleDismissCoachmark]);

  const handleTextPress = useCallback(() => {
    if (showCoachmark) handleDismissCoachmark();
    router.push('/record-text');
  }, [router, showCoachmark, handleDismissCoachmark]);

  // First-record transition: kick off the AI preview task the moment we see
  // first_record_at flip from null → real value. Re-entering with a record
  // already present is a no-op.
  useEffect(() => {
    const prev = prevFirstRecordAtRef.current;
    const next = user?.first_record_at ?? null;
    prevFirstRecordAtRef.current = next;
    if (!prev && next && !user?.ai_preview) {
      setStreamFailed(false);
      void requestAiPreview().catch(() => setStreamFailed(true));
    }
  }, [user?.first_record_at, user?.ai_preview]);

  // SSE: subscribe while the preview is pending, close on ready/unmount.
  useEffect(() => {
    if (!user?.first_record_at) return;
    if (user.ai_preview) return;

    setStreamOpen(true);
    const close = openAiPreviewStream(
      (e) => {
        if (e.status === 'ok') {
          applyAiPreview(e.preview);
          setStreamFailed(false);
        } else {
          setStreamFailed(true);
        }
      },
      () => {
        setStreamFailed(true);
      },
    );
    return () => {
      setStreamOpen(false);
      close();
    };
  }, [user?.first_record_at, user?.ai_preview, applyAiPreview]);

  const aiPreviewStatus: AiPreviewStatus = useMemo(() => {
    if (user?.ai_preview) return 'ready';
    if (!user?.first_record_at) return 'teaser';
    if (streamFailed && !streamOpen) return 'failed';
    return 'loading';
  }, [user?.ai_preview, user?.first_record_at, streamFailed, streamOpen]);

  const handleRetry = useCallback(() => {
    setStreamFailed(false);
    void requestAiPreview().catch(() => setStreamFailed(true));
  }, []);

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
        testID="home-question-card"
        badgeTestID="home-week-badge"
      />

      {showCoachmark ? (
        <Coachmark
          label={COACHMARK_LABEL}
          onDismiss={handleDismissCoachmark}
          arrowAlign="left"
          style={styles.coachmarkAlign}
          testID="home-coachmark"
          dismissTestID="home-coachmark-dismiss"
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
            testID="home-voice-cta"
          />
        </View>
        <View style={styles.ctaItem}>
          <Button
            title="텍스트"
            leading="✏️"
            variant="secondary"
            fullWidth
            onPress={handleTextPress}
            testID="home-text-cta"
          />
        </View>
      </View>

      <AiPreviewCard
        status={aiPreviewStatus}
        content={user?.ai_preview ?? null}
        onRetry={handleRetry}
        testID="home-ai-preview"
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
  coachmarkAlign: {
    alignSelf: 'flex-start',
  },
  identity: { textAlign: 'center', marginTop: spacing[2] },
});
