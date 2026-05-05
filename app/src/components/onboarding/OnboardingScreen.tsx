// OnboardingScreen — 와이어프레임의 카드형 화면 골격을 한 번에 처리.
// 모든 케이스 진행 화면이 동일한 구조(상단 ProgressBar + 본문 + 하단 CTA)
// 를 가지므로, 화면별 코드는 본문에만 집중할 수 있게 했다.
//
// 구성:
//   ┌────────────────────────────┐
//   │  ProgressBar               │  ← case 액센트
//   │  (선택) RepeatBadge 우측   │
//   │                            │
//   │  children                  │  ← 화면 본문
//   │                            │
//   │  Primary CTA / Secondary   │
//   └────────────────────────────┘

import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';

import { Button } from '../Button';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

import { CaseAccentProvider } from './CaseAccent';
import { ProgressBar } from './ProgressBar';
import { RepeatBadge } from './RepeatBadge';

import type { OnboardingCase } from '../../api/onboarding';

export type OnboardingScreenProps = {
  /** 'A'|'B'|'C' or null/undefined for the common Q1/Q2 entry pages. */
  case?: OnboardingCase | null;
  /** Step number, 1-based, used by the progress bar. */
  step: number;
  /** Total number of steps in this case. */
  totalSteps: number;
  /** Optional progress label (e.g. "Case B · 1단계"). Falls back to
   *  "Case A · n/N" / "n / N" when omitted. */
  progressLabel?: string;
  /** "반복 n/N" badge — appears in B2/B5/C2 only. */
  repeat?: { current: number; total: number };
  /** Primary CTA label + onPress. Disabled while submitting. */
  cta: { title: string; onPress: () => void; disabled?: boolean; testID?: string };
  /** Optional secondary tappable text below the primary CTA. */
  secondary?: { title: string; onPress: () => void; testID?: string };
  /** Optional inline error for last submit attempt. */
  errorMessage?: string;
  /** Body content. */
  children: ReactNode;
  /** testID for E2E. */
  testID?: string;
};

export function OnboardingScreen({
  case: c,
  step,
  totalSteps,
  progressLabel,
  repeat,
  cta,
  secondary,
  errorMessage,
  children,
  testID,
}: OnboardingScreenProps) {
  return (
    <CaseAccentProvider case={c ?? null}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID={testID}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ProgressBar current={step} total={totalSteps} label={progressLabel} />
            </View>
            {repeat ? (
              <RepeatBadge current={repeat.current} total={repeat.total} />
            ) : null}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            // Soft keyboard hides as soon as the user starts dragging
            // the body. Combined with keyboardShouldPersistTaps this
            // covers the common Maestro patterns (drag/scroll to a
            // field) without an outer Pressable wrapper that would
            // race with child onPress handlers.
            keyboardDismissMode="on-drag"
          >
            {children}
          </ScrollView>

          <View style={styles.actions}>
            <Button
              title={cta.title}
              variant="primary"
              fullWidth
              disabled={cta.disabled}
              onPress={cta.onPress}
              testID={cta.testID}
            />
            {secondary ? (
              <Button
                title={secondary.title}
                variant="secondary"
                fullWidth
                onPress={secondary.onPress}
                testID={secondary.testID}
              />
            ) : null}
            {errorMessage ? (
              <Text variant="caption" color="coral" style={styles.error}>
                {errorMessage}
              </Text>
            ) : null}
          </View>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingBottom: spacing[5],
  },
  body: { flex: 1 },
  bodyContent: { paddingBottom: spacing[6], gap: spacing[5] },
  actions: { gap: spacing[3], paddingTop: spacing[3] },
  error: { textAlign: 'center' },
});
