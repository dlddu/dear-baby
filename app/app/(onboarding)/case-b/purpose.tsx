// B6 — 아이별 기록 목적 (Case B는 아이별로 다른 목적 가능). 탭으로
// 아이를 전환하며 각 아이에 복수 선택. PRD-006 AC-006-03.
// 와이어프레임: docs/wireframes/onboarding/case-b.svg, B6.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RecordPurpose } from '../../../src/api/onboarding';
import { useAuth } from '../../../src/auth/AuthContext';
import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  CaseHeader,
  OptionCard,
  useCaseAccent,
} from '../../../src/components/onboarding';
import { clearDraft, loadDraft, type ChildDraft } from '../../../src/onboarding/draft';
import { PURPOSE_OPTIONS } from '../../../src/onboarding/purposes';
import { colors } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/radius';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBPurpose() {
  const router = useRouter();
  const { submitCaseOnboarding } = useAuth();
  const [children, setChildren] = useState<ChildDraft[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      setChildren(d.children);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePurpose = (idx: number, value: RecordPurpose) => {
    setChildren((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const purposes = new Set(c.purposes ?? []);
        if (purposes.has(value)) purposes.delete(value);
        else purposes.add(value);
        return { ...c, purposes: Array.from(purposes) };
      }),
    );
  };

  const allChildrenHavePurpose = children.length > 0 && children.every(
    (c) => (c.purposes ?? []).length > 0,
  );

  const onFinish = async () => {
    if (!allChildrenHavePurpose || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitCaseOnboarding({
        case: 'B',
        children: children.map((c) =>
          c.kind === 'fetus'
            ? {
                kind: 'fetus' as const,
                display_name: c.display_name,
                gender: c.gender!,
                pregnancy_weeks: c.pregnancy_weeks,
                due_date: c.due_date,
                purposes: c.purposes ?? [],
              }
            : {
                kind: 'child' as const,
                display_name: c.display_name,
                gender: c.gender!,
                birth_date: c.birth_date,
                introduction: c.introduction,
                photo_tmp_key: c.photo_tmp_key,
                purposes: c.purposes ?? [],
              },
        ),
      });
      await clearDraft();
    } catch {
      setError('지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  const tabLabel = (c: ChildDraft, idx: number) => {
    if (c.kind === 'child') {
      const ord = idx + 1;
      const ordLabel = ord === 1 ? '첫째' : ord === 2 ? '둘째' : ord === 3 ? '셋째' : `${ord}번째`;
      return c.display_name ?? ordLabel;
    }
    return c.display_name ?? '태아';
  };

  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-purpose">
        <ScrollView contentContainerStyle={styles.container}>
          <CaseHeader step={7} totalSteps={7} label="Case B · 마지막" />
          <Text variant="h2" color="primary" style={styles.heading}>
            아이별 기록 목적
          </Text>
          <Text variant="caption" color="muted" style={styles.hint}>
            아이마다 다르게 선택할 수 있어요
          </Text>

          <View style={styles.tabs}>
            {children.map((c, i) => (
              <ChildTab
                key={c.draft_id}
                label={tabLabel(c, i)}
                active={activeIdx === i}
                onPress={() => setActiveIdx(i)}
                testID={`case-b-purpose-tab-${i}`}
              />
            ))}
          </View>

          <View style={styles.options}>
            {PURPOSE_OPTIONS.map((opt) => {
              const active = children[activeIdx];
              const selected = (active?.purposes ?? []).includes(opt.value);
              return (
                <OptionCard
                  key={opt.value}
                  selected={selected}
                  onPress={() => togglePurpose(activeIdx, opt.value)}
                  testID={`case-b-purpose-${activeIdx}-${opt.value}`}
                >
                  <Text variant="body" color="primary" style={styles.optionLabel}>
                    {opt.label}
                  </Text>
                </OptionCard>
              );
            })}
          </View>

          {error ? (
            <Text variant="caption" color="coral" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title={submitting ? '저장 중…' : '홈으로 시작하기'}
            variant="primary"
            fullWidth
            disabled={!allChildrenHavePurpose || submitting}
            onPress={onFinish}
            testID="case-b-purpose-finish"
          />
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentTheme>
  );
}

function ChildTab({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const accent = useCaseAccent();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      testID={testID}
      style={({ pressed }) => [
        tabStyles.pill,
        {
          backgroundColor: active ? accent.bg : colors.surface.ivory,
          borderColor: active ? accent.bar : colors.bg.beige,
          borderWidth: active ? 2 : 1,
        },
        pressed && tabStyles.pressed,
      ]}
    >
      <Text variant="caption" style={{ color: active ? accent.text : colors.text.secondary, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const tabStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  pressed: { opacity: 0.85 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
  },
  heading: { marginBottom: spacing[2] },
  hint: { marginBottom: spacing[5] },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[5] },
  options: { gap: spacing[3] },
  optionLabel: { fontWeight: '500' },
  error: { marginTop: spacing[4], textAlign: 'center' },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
