// Onboarding placeholder — Case B/C 결말.
//
// 본 PR 의 범위는 PRD-006 AC-006-01 (Q1·Q2 분기) 까지이고, AC-006-03 / 04
// 의 Case B/C 입력 흐름(M-07 이후)은 후속 작업이다. 그래서 Case B 또는 C
// 로 분기된 사용자는 임시로 본 화면에 도착해 "준비 중" 안내를 보고, CTA 로
// `completeOnboarding(null)` 을 호출해 홈으로 이동한다 (예정일 미상 상태와
// 동일).

import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function OnboardingNotReady() {
  const { completeAsBC } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const onStart = async () => {
    if (submitting) return;
    setHasError(false);
    setSubmitting(true);
    try {
      await completeAsBC();
      // AuthGate reroutes to /(tabs) automatically once status flips.
    } catch (e) {
      console.warn('[onboarding] completeAsBC failed', e);
      setHasError(true);
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-not-ready"
    >
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text variant="iconHero" color="coral">
            🌱
          </Text>
          <Text variant="h2Serif" color="primary" style={styles.title}>
            아이별 기록은{'\n'}곧 만나요
          </Text>
          <Text variant="emotion" color="secondary" style={styles.tagline}>
            지금은 일단 홈에서 시작해주세요.{'\n'}준비가 되는 대로 아이별
            기록을 안내해드릴게요.
          </Text>
        </View>

        <Card padding="lg" style={styles.card} surface="cream">
          <Text variant="caption" color="secondary" style={styles.note}>
            먼저 매일의 마음을 기록하다 보면, 아이별 기록 기능이 열렸을
            때 자연스럽게 이어드릴게요.
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button
            title={submitting ? '저장 중…' : '홈으로 시작하기'}
            variant="primary"
            fullWidth
            disabled={submitting}
            onPress={onStart}
            testID="onboarding-not-ready-start"
          />
          {hasError && (
            <Text
              variant="caption"
              color="coral"
              style={styles.error}
              testID="onboarding-not-ready-error"
            >
              지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.
            </Text>
          )}
        </View>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: spacing[3],
  },
  title: { textAlign: 'center' },
  tagline: { textAlign: 'center' },
  card: { gap: spacing[3] },
  note: { lineHeight: typography.tagline.lineHeight },
  actions: { gap: spacing[3] },
  error: { textAlign: 'center' },
});
