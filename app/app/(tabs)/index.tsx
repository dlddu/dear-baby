import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { openAiPreviewStream, requestAiPreview } from '../../src/api/ai';
import {
  AiPreviewCard,
  type AiPreviewStatus,
} from '../../src/components/AiPreviewCard';
import { Button } from '../../src/components/Button';
import { Coachmark } from '../../src/components/Coachmark';
import { QuestionCard } from '../../src/components/QuestionCard';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthContext';
import { pickDailyQuestion } from '../../src/data/dailyQuestions';
import * as draftStore from '../../src/drafts/draftStore';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { shadows } from '../../src/theme/shadows';
import { spacing } from '../../src/theme/spacing';
import { calcPregnancy } from '../../src/utils/pregnancy';

// HomeTab renders Stage 2 of onboarding — voice-record coachmark + daily
// question card + dual CTAs + AI preview card. See docs/design-system/
// onboarding.md for the spec. The voice CTA now routes to the dedicated
// recording flow (record-audio → record-audio-review) instead of the
// "곧 추가됩니다" alert. When the user has audio waiting in the local
// archive, a banner above the CTAs surfaces the entry point to /drafts.
//
// AI preview flow: when `first_record_at` flips from null → set (first
// save), the home kicks off a `requestAiPreview()` and opens an SSE
// stream to listen for `ready` or `error`. The SSE stream is closed and
// reopened automatically when the preview state changes.

const COACHMARK_LABEL = '🎙 말하기만 해도 기록이 돼요!';
const ENCOURAGEMENT = '첫 기록이 가장 소중해요 🌱';

export default function HomeTab() {
  const router = useRouter();
  const { user, dismissVoiceCoachmark, applyAiPreview } = useAuth();
  // Local flag hides the coachmark immediately on tap; the backend call is
  // fire-and-forget so the UI never waits on the network. Persisted state
  // comes from `user.voice_coachmark_dismissed_at` on next session load.
  const [coachmarkHidden, setCoachmarkHidden] = useState(false);
  // `aiPreviewFailed` flips when the SSE stream reports an error; reset
  // whenever the user asks for a retry.
  const [aiPreviewFailed, setAiPreviewFailed] = useState(false);
  // `aiStreamOpen` tracks whether the SSE effect currently has a live
  // subscription. Used to distinguish "loading" (stream open, waiting)
  // from "failed" (stream errored or never opened).
  const [aiStreamOpen, setAiStreamOpen] = useState(false);
  // draftCount drives the "보관 중인 음성 원본 N개" banner. Refetched on
  // every focus so returning from the review or drafts screen reflects
  // the latest archive size without a manual refresh.
  const [draftCount, setDraftCount] = useState(0);

  const prevFirstRecordAtRef = useRef<string | null>(null);

  // Pregnancy progress now lives on the active child (AC-006-08+), not
  // on the user. Until that lands the home screen renders without a
  // due-date badge — passing null preserves the existing component
  // contract while the home/active-child wiring is built out.
  const pregnancy = useMemo(() => calcPregnancy(null), []);
  const question = useMemo(() => pickDailyQuestion(), []);

  const showCoachmark =
    !coachmarkHidden &&
    !user?.voice_coachmark_dismissed_at &&
    !user?.first_record_at;

  // Detect null → non-null transition of first_record_at: the moment we
  // should ask the backend to kick off AI preview generation. Runs only
  // on the transition itself so repeated re-renders don't re-fire.
  useEffect(() => {
    const prev = prevFirstRecordAtRef.current;
    const current = user?.first_record_at ?? null;
    prevFirstRecordAtRef.current = current;
    if (!prev && current && !user?.ai_preview) {
      setAiPreviewFailed(false);
      void requestAiPreview().catch(() => setAiPreviewFailed(true));
    }
  }, [user?.first_record_at, user?.ai_preview]);

  // Subscribe to the SSE stream while the preview is pending. Automatic
  // close on unmount, and on every input change (so status transitions
  // clean up cleanly).
  useEffect(() => {
    if (!user?.first_record_at) return undefined;
    if (user.ai_preview) return undefined;
    setAiStreamOpen(true);
    const close = openAiPreviewStream(
      (evt) => {
        if (evt.type === 'ready') {
          setAiPreviewFailed(false);
          void applyAiPreview(evt.preview);
        } else {
          setAiPreviewFailed(true);
        }
      },
      () => {
        setAiPreviewFailed(true);
      },
    );
    return () => {
      setAiStreamOpen(false);
      close();
    };
  }, [user?.first_record_at, user?.ai_preview, applyAiPreview]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void draftStore.count().then((n) => {
        if (!cancelled) setDraftCount(n);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleRetry = useCallback(() => {
    setAiPreviewFailed(false);
    void requestAiPreview().catch(() => setAiPreviewFailed(true));
  }, []);

  const aiPreviewStatus = useMemo<AiPreviewStatus>(() => {
    if (user?.ai_preview) return 'ready';
    if (!user?.first_record_at) return 'teaser';
    if (aiPreviewFailed) return 'failed';
    if (aiStreamOpen) return 'loading';
    return 'loading';
  }, [user?.ai_preview, user?.first_record_at, aiPreviewFailed, aiStreamOpen]);

  const handleDismissCoachmark = useCallback(() => {
    setCoachmarkHidden(true);
    // Swallow errors: a transient failure just means the coachmark will
    // appear again next cold boot, which is acceptable.
    void dismissVoiceCoachmark().catch(() => {});
  }, [dismissVoiceCoachmark]);

  const handleVoicePress = useCallback(() => {
    if (showCoachmark) handleDismissCoachmark();
    router.push({
      pathname: '/record-audio',
      params: { question, week_label: pregnancy?.label ?? '' },
    });
  }, [router, showCoachmark, handleDismissCoachmark, question, pregnancy]);

  const handleTextPress = useCallback(() => {
    if (showCoachmark) handleDismissCoachmark();
    router.push({
      pathname: '/record-text',
      params: { question, week_label: pregnancy?.label ?? '' },
    });
  }, [router, showCoachmark, handleDismissCoachmark, question, pregnancy]);

  const handleDraftsPress = useCallback(() => {
    router.push('/drafts');
  }, [router]);

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
          arrowAlign="left"
          onDismiss={handleDismissCoachmark}
          testID="stage2-coachmark"
          dismissTestID="stage2-coachmark-dismiss"
        />
      ) : null}

      {draftCount > 0 ? (
        <Pressable
          onPress={handleDraftsPress}
          style={styles.draftsBanner}
          testID="drafts-banner"
        >
          <Text variant="caption" color="onPrimary">
            🎙 보관 중인 음성 원본 {draftCount}개
          </Text>
          <Text variant="caption" color="onPrimary">
            보관함 열기 →
          </Text>
        </Pressable>
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
        status={aiPreviewStatus}
        content={user?.ai_preview}
        onRetry={handleRetry}
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
  draftsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary.coral,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    ...shadows.soft,
  },
});
