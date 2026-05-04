// B6 — 아이별 기록 목적 (PRD-006 AC-006-03 ③)
//
// Case B keeps purposes per-child: 첫째/둘째/태아처럼 아이마다 다른
// 목적을 선택할 수 있어야 한다. 화면은 (1) 상단에 아이 탭, (2) 본문에
// 활성 아이의 PurposePicker, (3) 하단에 모든 아이가 1개 이상 선택한
// 경우에만 활성화되는 제출 버튼으로 구성된다.

import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  OnboardingProgressBar,
  PurposePicker,
  useCaseAccent,
} from '../../../src/components/onboarding';
import { useAuth } from '../../../src/auth/AuthContext';
import {
  clearDraft,
  loadDraft,
  type ChildDraft,
  type OnboardingDraft,
} from '../../../src/onboarding/draft';
import type {
  CaseSubmissionPayload,
  ChildSubmission,
  RecordPurpose,
} from '../../../src/api/onboarding';
import { colors } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/radius';
import { spacing } from '../../../src/theme/spacing';

function buildPayload(draft: OnboardingDraft): CaseSubmissionPayload {
  const children: ChildSubmission[] = draft.children.map((c) => {
    const base: ChildSubmission = {
      kind: c.kind,
      gender: c.gender ?? 'undecided',
      purposes: c.purposes ?? [],
    };
    if (c.display_name) base.display_name = c.display_name;
    if (c.introduction) base.introduction = c.introduction;
    if (c.photo_tmp_key) base.photo_tmp_key = c.photo_tmp_key;
    if (c.kind === 'child') {
      if (c.birth_date) base.birth_date = c.birth_date;
    } else {
      if (typeof c.pregnancy_weeks === 'number') base.pregnancy_weeks = c.pregnancy_weeks;
      if (c.due_date) base.due_date = c.due_date;
    }
    return base;
  });
  return { case: 'B', children };
}

function tabLabel(c: ChildDraft): string {
  if (c.display_name) return c.display_name;
  if (c.kind === 'fetus') return '태아';
  return '아이';
}

export default function CaseBPurpose() {
  const { submitCaseOnboarding } = useAuth();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const d = await loadDraft();
      setDraft(d);
    })();
  }, []);

  const activeChild = draft?.children[activeIdx];

  const allReady = useMemo(() => {
    if (!draft) return false;
    return draft.children.every((c) => (c.purposes ?? []).length > 0);
  }, [draft]);

  const setActivePurposes = (next: RecordPurpose[]) => {
    if (!draft || !activeChild) return;
    const updatedChildren = draft.children.map((c, i) =>
      i === activeIdx ? { ...c, purposes: next } : c,
    );
    setDraft({ ...draft, children: updatedChildren });
  };

  const onStart = async () => {
    if (!draft || !allReady || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      // Persist the in-memory updates so retries pick them up too.
      const persisted = await import('../../../src/onboarding/draft').then(
        (m) => m.saveDraft({ children: draft.children }),
      );
      await submitCaseOnboarding(buildPayload(persisted));
      await clearDraft();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-case-b-purpose">
        <OnboardingProgressBar n={7} of={7} />
        <View style={styles.body}>
          <View style={styles.hero}>
            <Text variant="h2" color="primary" style={styles.heading}>
              아이마다 어떤 마음으로 기록을 남길지 골라주세요
            </Text>
          </View>
          {draft ? (
            <ChildTabs
              draft={draft}
              activeIdx={activeIdx}
              onSelect={setActiveIdx}
            />
          ) : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
          >
            {activeChild ? (
              <PurposePicker
                value={activeChild.purposes ?? []}
                onChange={setActivePurposes}
                testID={`case-b-purpose-${activeIdx}`}
              />
            ) : null}
          </ScrollView>
        </View>
        <View style={styles.footer}>
          {error ? (
            <Text variant="caption" color="coral" style={styles.error} testID="case-b-purpose-error">
              지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.
            </Text>
          ) : null}
          <Button
            title={submitting ? '저장 중…' : '홈으로 시작하기'}
            variant="primary"
            fullWidth
            disabled={!allReady || submitting}
            onPress={onStart}
            testID="case-b-purpose-submit"
          />
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentTheme>
  );
}

function ChildTabs({
  draft,
  activeIdx,
  onSelect,
}: {
  draft: OnboardingDraft;
  activeIdx: number;
  onSelect: (i: number) => void;
}) {
  const { color } = useCaseAccent();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
      style={styles.tabsScroll}
    >
      {draft.children.map((c, i) => {
        const selected = i === activeIdx;
        const ready = (c.purposes ?? []).length > 0;
        return (
          <Pressable
            key={c.local_id}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={`case-b-purpose-tab-${i}`}
            style={({ pressed }) => [
              styles.tab,
              selected && { borderColor: color, backgroundColor: color + '14' },
              pressed && styles.pressed,
            ]}
          >
            <Text
              variant="body"
              color={selected ? 'primary' : 'secondary'}
              style={[styles.tabLabel, selected && { color }]}
            >
              {tabLabel(c)}
            </Text>
            {ready ? (
              <View style={[styles.dot, { backgroundColor: color }]} />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  body: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    gap: spacing[5],
  },
  hero: { gap: spacing[2] },
  heading: { textAlign: 'left' },
  // Horizontal ScrollView's outer container otherwise stretches its
  // children vertically (cross-axis = vertical when horizontal=true) —
  // observed on Android emulator where each tab inflated to ~225 px,
  // pushing the second row of PurposePicker chips off-screen and
  // breaking the case-b Maestro flow.
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: spacing[2], paddingVertical: spacing[1], alignItems: 'flex-start' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
  },
  tabLabel: { fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pressed: { opacity: 0.85 },
  scroll: { flex: 1 },
  scrollBody: { paddingBottom: spacing[6] },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },
  error: { textAlign: 'center' },
});
