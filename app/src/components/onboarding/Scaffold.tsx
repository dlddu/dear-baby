// Common chrome for every onboarding screen: SafeAreaView + cream
// background + top progress bar + case label + scrollable content area
// + bottom CTA. Extracted because all 13 case-onboarding screens follow
// the same shape — putting it in a single file keeps spacing /
// indicator placement / CTA disabled-state behavior consistent.

import { StatusBar } from 'expo-status-bar';
import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaseLabel } from './CaseLabel';
import { ProgressBar } from './ProgressBar';
import type { CaseKind } from '../../api/onboarding';
import { Button } from '../Button';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export type ScaffoldProps = {
  caseKind?: CaseKind | null;
  step: number;
  total: number;
  /** Optional override for the case label text (e.g. "Case B · 1단계 ①"). */
  labelOverride?: string;
  /** Optional widget rendered at the right of the case label row (e.g. RepeatBadge). */
  trailing?: ReactNode;
  title: string;
  subtitle?: string;
  ctaTitle: string;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  onCta: () => void;
  /** Optional secondary action below the CTA (e.g. "건너뛰기"). */
  secondary?: ReactNode;
  errorText?: string | null;
  testID?: string;
  children: ReactNode;
};

export function OnboardingScaffold({
  caseKind,
  step,
  total,
  labelOverride,
  trailing,
  title,
  subtitle,
  ctaTitle,
  ctaDisabled,
  ctaLoading,
  onCta,
  secondary,
  errorText,
  testID,
  children,
}: ScaffoldProps) {
  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID={testID}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <ProgressBar step={step} total={total} caseKind={caseKind} />
          <View style={styles.headerRow}>
            <CaseLabel
              caseKind={caseKind}
              step={step}
              total={total}
              prefix={labelOverride}
            />
            {trailing}
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            <Text variant="h2" color="primary" style={styles.title}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" color="secondary" style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : null}
            <View style={styles.body}>{children}</View>
          </ScrollView>
          <View style={styles.footer}>
            {errorText ? (
              <Text variant="caption" color="coral" style={styles.error}>
                {errorText}
              </Text>
            ) : null}
            <Button
              title={ctaLoading ? '저장 중…' : ctaTitle}
              variant="primary"
              fullWidth
              disabled={ctaDisabled || ctaLoading}
              onPress={onCta}
              testID={testID ? `${testID}-cta` : undefined}
            />
            {secondary ? <View style={styles.secondary}>{secondary}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scroll: { paddingBottom: spacing[6] },
  title: { marginTop: spacing[4] },
  subtitle: { marginTop: spacing[2] },
  body: { marginTop: spacing[6], gap: spacing[4] },
  footer: { gap: spacing[2] },
  error: { textAlign: 'center' },
  secondary: { alignItems: 'center', paddingVertical: spacing[2] },
});
