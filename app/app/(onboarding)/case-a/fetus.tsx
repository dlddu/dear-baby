// A2 — 태아 정보 입력. 태명·성별·임신 주차·예정일을 받는다. 다태일 경우
// 카운트만큼 반복(반복 n/N 배지로 진행 표시). PRD-006 AC-006-02.
// 와이어프레임: docs/wireframes/onboarding/case-a.svg, A2.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  CaseHeader,
  DateField,
  GenderToggle,
} from '../../../src/components/onboarding';
import { loadDraft, saveDraft, type ChildDraft } from '../../../src/onboarding/draft';
import { colors } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/radius';
import { spacing } from '../../../src/theme/spacing';

export default function CaseAFetus() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildDraft[]>([]);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      setChildren(d.children.filter((c) => c.kind === 'fetus'));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = children.length;
  const current = children[index];
  const isLast = index === total - 1;

  const update = (patch: Partial<ChildDraft>) => {
    setChildren((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const isComplete = (c?: ChildDraft) =>
    !!c && !!c.gender && !!c.pregnancy_weeks && !!c.due_date;

  const onNext = async () => {
    if (!isComplete(current) || submitting) return;
    setSubmitting(true);
    await saveDraft({ children, last_step: '/case-a/fetus' });
    if (isLast) {
      router.push('/(onboarding)/case-a/purpose');
    } else {
      setIndex(index + 1);
    }
    setSubmitting(false);
  };

  if (!current) return null;

  return (
    <CaseAccentTheme case="A">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-a-fetus">
        <ScrollView contentContainerStyle={styles.container}>
          <CaseHeader
            step={2}
            totalSteps={3}
            label="Case A · 2/3"
            repeat={total > 1 ? { current: index + 1, total } : undefined}
          />
          <Text variant="h2" color="primary" style={styles.heading}>
            태아 정보를 알려주세요
          </Text>

          <View style={styles.field}>
            <Text variant="caption" color="muted">태명 (선택)</Text>
            <TextInput
              value={current.display_name ?? ''}
              onChangeText={(v) => update({ display_name: v })}
              placeholder="튼튼이"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              testID="case-a-fetus-name"
            />
          </View>

          <View style={styles.field}>
            <Text variant="caption" color="muted">성별</Text>
            <GenderToggle
              value={current.gender}
              onChange={(g) => update({ gender: g })}
            />
          </View>

          <View style={styles.field}>
            <Text variant="caption" color="muted">임신 주차</Text>
            <View style={styles.weeksRow}>
              <TextInput
                value={current.pregnancy_weeks?.toString() ?? ''}
                onChangeText={(v) =>
                  update({
                    pregnancy_weeks: v ? Math.max(0, Math.min(45, parseInt(v, 10) || 0)) : undefined,
                  })
                }
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                style={[styles.input, styles.weeksInput]}
                testID="case-a-fetus-weeks"
              />
              <Text variant="body" color="secondary">주</Text>
            </View>
          </View>

          <DateField
            label="예정일"
            value={current.due_date}
            onChange={(iso) => update({ due_date: iso })}
            futureOnly
            testID="case-a-fetus-due-date"
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={isLast ? '다음' : `다음 아이 (${index + 2}/${total})`}
            variant="primary"
            fullWidth
            disabled={!isComplete(current) || submitting}
            onPress={onNext}
            testID="case-a-fetus-next"
          />
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentTheme>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
    gap: spacing[5],
  },
  heading: { marginBottom: spacing[3] },
  field: { gap: spacing[2] },
  input: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    color: colors.text.primary,
    fontSize: 15,
  },
  weeksRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  weeksInput: { flex: 1 },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
