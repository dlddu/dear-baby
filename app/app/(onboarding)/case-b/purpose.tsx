// B6 — 아이별 기록 목적 (Case B 마지막)
//
// Per-child multi-select. Top row of pills lets the user switch between
// children; the active pill matches the case accent. Each child gets
// its own purpose array stored in the draft, then submitted together.
//
// Wireframe: docs/wireframes/onboarding/case-b.svg (B6 panel).

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  DEFAULT_PURPOSE_OPTIONS,
  PurposeList,
  ScreenScaffold,
  accentFor,
} from '../../../src/components/onboarding';
import { useAuth } from '../../../src/auth/AuthContext';
import { radius } from '../../../src/theme/radius';
import { spacing } from '../../../src/theme/spacing';
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type OnboardingDraft,
} from '../../../src/onboarding/draft';
import type { RecordPurpose } from '../../../src/api/types';

export default function CaseBPurpose() {
  const router = useRouter();
  const { submitCaseOnboarding } = useAuth();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    void (async () => {
      const d = await loadDraft();
      if (d.case !== 'B' || d.children.length === 0) {
        router.replace('/(onboarding)/q1');
        return;
      }
      setDraft(d);
    })();
  }, [router]);

  const accent = accentFor('B');
  const labels = useMemo(() => {
    if (!draft) return [] as string[];
    let kidIdx = 0;
    return draft.children.map((c) => {
      if (c.kind === 'child') {
        kidIdx += 1;
        const ord = ['첫째', '둘째', '셋째', '넷째', '다섯째'][kidIdx - 1] ?? `${kidIdx}째`;
        return c.display_name ? `${c.display_name}` : ord;
      }
      return c.display_name ? `${c.display_name}` : '태아';
    });
  }, [draft]);

  const setPurposesForActive = (next: RecordPurpose[]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const children = prev.children.map((c, i) =>
        i === activeIdx ? { ...c, purposes: next } : c,
      );
      return { ...prev, children };
    });
  };

  const allFilled = draft?.children.every(
    (c) => c.purposes && c.purposes.length > 0,
  );

  const onSubmit = async () => {
    if (!draft || submitting || !allFilled) return;
    setHasError(false);
    setSubmitting(true);
    try {
      await saveDraft(() => draft);
      await submitCaseOnboarding({
        case: 'B',
        children: draft.children.map((c) => ({
          kind: c.kind,
          gender: c.gender ?? 'undecided',
          display_name: c.display_name,
          introduction: c.introduction,
          birth_date: c.birth_date,
          pregnancy_weeks: c.pregnancy_weeks,
          due_date: c.due_date,
          photo_tmp_key: c.photo_tmp_key,
          purposes: c.purposes ?? [],
        })),
      });
      await clearDraft();
      router.replace('/(tabs)');
    } catch (err) {
      console.warn('[onboarding] submitCase failed', err);
      setHasError(true);
      setSubmitting(false);
    }
  };

  if (!draft) return null;
  const active = draft.children[activeIdx];

  return (
    <ScreenScaffold
      case="B"
      current={7}
      total={7}
      stepLabel="Case B · 마지막"
      testID="onboarding-b6"
      actions={
        <View style={styles.actionsCol}>
          <Button
            title={submitting ? '저장 중…' : '홈으로 시작하기'}
            variant="primary"
            fullWidth
            disabled={!allFilled || submitting}
            onPress={onSubmit}
            testID="onboarding-b6-submit"
          />
          {hasError ? (
            <Text variant="caption" color="coral" style={styles.error}>
              지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.
            </Text>
          ) : null}
        </View>
      }
    >
      <View style={styles.headerBlock}>
        <Text variant="h2" color="primary">
          아이별 기록 목적
        </Text>
        <Text variant="caption" color="muted">
          아이마다 다르게 선택할 수 있어요
        </Text>
      </View>
      <View style={styles.tabs}>
        {labels.map((label, i) => {
          const selected = i === activeIdx;
          return (
            <Pressable
              key={`${label}-${i}`}
              onPress={() => setActiveIdx(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              testID={`onboarding-b6-tab-${i}`}
              style={[
                styles.tab,
                selected
                  ? { backgroundColor: accent.surface, borderColor: accent.bar }
                  : styles.tabIdle,
              ]}
            >
              <Text variant="caption" style={selected ? { color: accent.text, fontWeight: '600' } : undefined}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <PurposeList
        options={DEFAULT_PURPOSE_OPTIONS}
        values={active?.purposes ?? []}
        onChange={setPurposesForActive}
        testID="onboarding-b6-purposes"
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing[2] },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  tab: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tabIdle: {
    backgroundColor: 'transparent',
    borderColor: '#D3D1C7',
  },
  actionsCol: { gap: spacing[2] },
  error: { textAlign: 'center' },
});
