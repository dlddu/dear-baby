// B6 — 아이별 기록 목적 (Case B 마지막 화면)
// docs/wireframes/onboarding/case-b.svg
//
// Each child has its own purpose set. The screen renders pill tabs at
// the top for the children entered so far, plus a multi-select per
// active tab. The CTA enables only when every child has at least one
// purpose selected.

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '../../../src/auth/AuthContext';
import {
  OnboardingScaffold,
  PurposesPicker,
  caseAccent,
} from '../../../src/components/onboarding';
import { Text } from '../../../src/components/Text';
import { loadDraft, saveDraft } from '../../../src/onboarding/draft';
import type { ChildDraft } from '../../../src/onboarding/draft';
import type { RecordPurpose } from '../../../src/api/onboarding';
import { buildCasePayload } from '../../../src/onboarding/submit';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBPurposeScreen() {
  const router = useRouter();
  const { submitCaseOnboarding } = useAuth();
  const [children, setChildren] = useState<ChildDraft[]>([]);
  const [active, setActive] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDraft().then((d) => setChildren(d.children));
  }, []);

  const accent = caseAccent('B');

  const labels = useMemo(() => children.map((c, i) => labelFor(c, i, children)), [children]);

  const setPurposes = (idx: number, next: RecordPurpose[]) => {
    setChildren((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], purposes: next };
      return updated;
    });
  };

  const allReady =
    children.length > 0 &&
    children.every((c) => (c.purposes?.length ?? 0) > 0);

  const onNext = async () => {
    if (submitting || !allReady) return;
    setError(null);
    setSubmitting(true);
    try {
      const next = await saveDraft({ children });
      const payload = buildCasePayload(next);
      if (!payload) {
        throw new Error('입력이 비어 있어요. 처음부터 다시 진행해 주세요.');
      }
      await submitCaseOnboarding(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출 중 문제가 생겼어요.');
      setSubmitting(false);
    }
  };

  const activePurposes = children[active]?.purposes ?? [];

  return (
    <OnboardingScaffold
      caseKind={'B'}
      step={7}
      total={7}
      labelOverride={'Case B · 마지막'}
      title={'아이별 기록 목적'}
      subtitle={'아이마다 다르게 선택할 수 있어요'}
      ctaTitle={'홈으로 시작하기'}
      ctaDisabled={!allReady}
      ctaLoading={submitting}
      onCta={onNext}
      errorText={error}
      testID={'onboarding-b6'}
    >
      <View style={styles.tabs}>
        {labels.map((label, i) => {
          const selected = i === active;
          const ready = (children[i]?.purposes?.length ?? 0) > 0;
          return (
            <Pressable
              key={`${label}-${i}`}
              onPress={() => setActive(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              testID={`b6-tab-${i}`}
              style={({ pressed }) => [
                styles.tab,
                selected && {
                  backgroundColor: accent.tint,
                  borderColor: accent.bar,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                variant="caption"
                style={{
                  color: selected ? accent.label : colors.text.secondary,
                  fontWeight: selected ? '600' : '400',
                }}
              >
                {label}
                {ready ? ' ✓' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <PurposesPicker
        value={activePurposes}
        onChange={(next) => setPurposes(active, next)}
        caseKind={'B'}
      />
    </OnboardingScaffold>
  );
}

function labelFor(c: ChildDraft, i: number, all: ChildDraft[]): string {
  if (c.kind === 'fetus') {
    if (c.displayName) return c.displayName;
    const fetusIdx = all
      .slice(0, i + 1)
      .filter((x) => x.kind === 'fetus').length;
    return all.filter((x) => x.kind === 'fetus').length > 1
      ? `태아${fetusIdx}`
      : '태아';
  }
  if (c.displayName) return c.displayName;
  const labels = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
  return labels[i] ?? `${i + 1}번째`;
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
    paddingBottom: spacing[2],
  },
  tab: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
  },
});
