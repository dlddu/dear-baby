// PRD-006 Case B · 6/6 — 아이별 기록 목적 선택. AC-006-03 ③ 의 핵심:
// 양육·임신 아이가 섞여 있어도 한 화면에서 카드 단위로 각자 다른 목적
// 셋을 고를 수 있어야 한다. 상태는 로컬 (selected[i]) 로 관리한 뒤
// 제출 시 draft.purposes 전체를 갱신한다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import {
  DEFAULT_PURPOSES,
  PurposeSelector,
} from '../../../src/components/onboarding/PurposeSelector';
import { StepHeader } from '../../../src/components/onboarding/StepHeader';
import { Text } from '../../../src/components/Text';
import { useAuth } from '../../../src/auth/AuthContext';
import {
  type ChildDraft,
  useOnboardingDraft,
} from '../../../src/auth/onboardingDraft';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

function childLabel(child: ChildDraft, index: number): string {
  const fallback = child.status === 'parenting' ? '양육 중인 아이' : '곧 만날 아기';
  const name = child.name ?? '';
  const trimmed = name.trim();
  if (trimmed !== '') {
    if (child.status === 'parenting') return `${trimmed} (양육 중)`;
    if (child.pregnancy_week != null) return `${trimmed} (임신 ${child.pregnancy_week}주)`;
    return `${trimmed} (임신 중)`;
  }
  if (child.status === 'parenting') return `${fallback} ${index + 1}`;
  return `${fallback} ${index + 1}`;
}

export default function CaseBPurposes() {
  const router = useRouter();
  const { draft, update } = useOnboardingDraft();
  const { completeOnboarding } = useAuth();

  const [selected, setSelected] = useState<string[][]>(() =>
    draft.children.map((_, i) => draft.purposes[i] ?? []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAt = (childIdx: number, purposeId: string) => {
    setSelected((prev) =>
      prev.map((list, i) =>
        i !== childIdx
          ? list
          : list.includes(purposeId)
            ? list.filter((x) => x !== purposeId)
            : [...list, purposeId],
      ),
    );
  };

  const allChosen = selected.every((s) => s.length > 0);

  const onFinish = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await update({ purposes: selected });
      await completeOnboarding();
    } catch (e) {
      console.warn('[onboarding] case B submit failed', e);
      setError('지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-purposes">
      <StepHeader progress="Case B · 6/6" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heading}>
          <Text variant="h2" color="primary">
            각 아이마다 기록의{'\n'}목적이 다를 수 있어요
          </Text>
          <Text variant="caption" color="muted">
            아이마다 한 가지 이상 골라 주세요
          </Text>
        </View>
        {draft.children.map((child, idx) => (
          <Card key={idx} padding="md" surface="cream" style={styles.childCard}>
            <Text variant="h3" color="primary" style={styles.childTitle}>
              {childLabel(child, idx)}
            </Text>
            <PurposeSelector
              options={DEFAULT_PURPOSES}
              selected={selected[idx] ?? []}
              onToggle={(p) => toggleAt(idx, p)}
              testIDPrefix={`case-b-purpose-${idx}`}
            />
          </Card>
        ))}
        <Button
          title={submitting ? '저장 중…' : '홈으로 가기'}
          variant="primary"
          fullWidth
          disabled={!allChosen || submitting}
          onPress={onFinish}
          testID="case-b-finish"
        />
        {error ? (
          <Text variant="caption" color="coral" style={styles.error} testID="case-b-error">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
    gap: spacing[5],
  },
  heading: { gap: spacing[2] },
  childCard: { gap: spacing[3] },
  childTitle: {},
  error: { textAlign: 'center' },
});
