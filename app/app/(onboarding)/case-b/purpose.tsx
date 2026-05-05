// B6 — 아이별 기록 목적. 양육 + 태아 모든 아이를 탭으로 전환하면서 각 아이마다
// 다중 선택. 와이어프레임 docs/wireframes/onboarding/case-b.svg.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '../../../src/auth/AuthContext';
import {
  Checkbox,
  OnboardingScreen,
  SelectCard,
  useCaseAccent,
} from '../../../src/components/onboarding';
import { Text } from '../../../src/components/Text';
import { colors } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/radius';
import { spacing } from '../../../src/theme/spacing';
import {
  clearDraft,
  loadDraft,
  saveDraft,
  upsertChild,
} from '../../../src/onboarding/draft';
import { buildSubmission } from '../../../src/onboarding/submit';

import type { ChildDraft } from '../../../src/onboarding/draft';
import type { RecordPurpose } from '../../../src/api/onboarding';

const OPTIONS: Array<{ value: RecordPurpose; title: string }> = [
  { value: 'book_making', title: '책 만들기' },
  { value: 'memory_keeping', title: '성장 일기' },
  { value: 'family_share', title: '가족과 공유' },
  { value: 'emotion_diary', title: '감정 정리' },
];

const ORDINAL = ['첫째', '둘째', '셋째', '넷째', '다섯째'];

function tabLabelFor(c: ChildDraft, ordinalIdx: number): string {
  if (c.kind === 'fetus') return c.display_name ? c.display_name : '태아';
  return ORDINAL[ordinalIdx] ?? `${ordinalIdx + 1}번째`;
}

export default function CaseBPurpose() {
  const router = useRouter();
  const { submitCaseOnboarding } = useAuth();

  const [children, setChildren] = useState<ChildDraft[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDraft().then((d) => {
      setChildren(d.children);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void saveDraft({ last_step: '/case-b/purpose' });
    }, []),
  );

  const tabs = useMemo(() => {
    let childOrd = 0;
    return children.map((c) => {
      const label = tabLabelFor(c, c.kind === 'child' ? childOrd : 0);
      if (c.kind === 'child') childOrd++;
      return label;
    });
  }, [children]);

  const active = children[activeIdx];
  const accent = useCaseAccent();

  const toggle = async (p: RecordPurpose) => {
    const cur = active?.purposes ?? [];
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
    setChildren((arr) => {
      const copy = [...arr];
      copy[activeIdx] = { ...copy[activeIdx], purposes: next };
      return copy;
    });
    if (active) {
      await upsertChild(activeIdx, { kind: active.kind, purposes: next });
    }
  };

  const allHavePurposes = children.length > 0 && children.every((c) => (c.purposes?.length ?? 0) > 0);

  const onSubmit = async () => {
    if (!allHavePurposes || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const draft = await loadDraft();
      const payload = buildSubmission(draft);
      await submitCaseOnboarding(payload);
      await clearDraft();
    } catch (e) {
      setError('지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScreen
      case="B"
      step={7}
      totalSteps={7}
      progressLabel="Case B · 마지막"
      cta={{
        title: submitting ? '저장 중…' : '홈으로 시작하기',
        onPress: onSubmit,
        disabled: !allHavePurposes || submitting,
        testID: 'b6-submit',
      }}
      errorMessage={error ?? undefined}
      testID="onboarding-b6"
    >
      <Text variant="h2" color="primary">
        아이별 기록 목적
      </Text>
      <Text variant="caption" color="secondary">
        아이마다 다르게 선택할 수 있어요
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {tabs.map((label, i) => {
          const selected = i === activeIdx;
          return (
            <Pressable
              key={`${label}-${i}`}
              accessibilityRole="button"
              onPress={() => setActiveIdx(i)}
              testID={`b6-tab-${i}`}
              style={[
                styles.tab,
                selected
                  ? { backgroundColor: accent.soft, borderColor: accent.base }
                  : { backgroundColor: colors.surface.ivory, borderColor: colors.bg.beige },
              ]}
            >
              <Text variant="caption" color={selected ? 'primary' : 'secondary'} style={styles.tabLabel}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ gap: spacing[3] }}>
        {OPTIONS.map((opt) => {
          const checked = active?.purposes?.includes(opt.value) ?? false;
          return (
            <SelectCard
              key={opt.value}
              title={opt.title}
              selected={checked}
              onPress={() => toggle(opt.value)}
              leading={<Checkbox checked={checked} />}
              testID={`b6-${opt.value}`}
            />
          );
        })}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: spacing[2], paddingVertical: spacing[2] },
  tab: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tabLabel: { fontWeight: '600' },
});
