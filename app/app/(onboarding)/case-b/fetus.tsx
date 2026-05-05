// B5 — 태아 정보 (반복). PRD-006 AC-006-03.
// 와이어프레임: docs/wireframes/onboarding/case-b.svg, B5.

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

export default function CaseBFetus() {
  const router = useRouter();
  const [allChildren, setAllChildren] = useState<ChildDraft[]>([]);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      setAllChildren(d.children);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetusRows = allChildren.filter((c) => c.kind === 'fetus');
  const total = fetusRows.length;
  const current = fetusRows[index];
  const isLast = index === total - 1;

  const update = (patch: Partial<ChildDraft>) => {
    setAllChildren((prev) => {
      let n = 0;
      return prev.map((c) => {
        if (c.kind !== 'fetus') return c;
        const matches = n === index;
        n += 1;
        return matches ? { ...c, ...patch } : c;
      });
    });
  };

  const isComplete = (c?: ChildDraft) =>
    !!c && !!c.gender && !!c.pregnancy_weeks && !!c.due_date;

  const onNext = async () => {
    if (!isComplete(current) || submitting) return;
    setSubmitting(true);
    await saveDraft({ children: allChildren, last_step: '/case-b/fetus' });
    if (isLast) {
      router.push('/(onboarding)/case-b/purpose');
    } else {
      setIndex(index + 1);
    }
    setSubmitting(false);
  };

  if (!current) return null;

  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-fetus">
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <CaseHeader
            step={6}
            totalSteps={7}
            label="Case B · 2단계 ②"
            repeat={total > 1 ? { current: index + 1, total } : undefined}
          />
          <Text variant="h2" color="primary" style={styles.heading}>
            태아 정보
          </Text>

          <View style={styles.field}>
            <Text variant="caption" color="muted">태명 (선택)</Text>
            <TextInput
              value={current.display_name ?? ''}
              onChangeText={(v) => update({ display_name: v })}
              placeholder="튼튼이"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              testID={`case-b-fetus-${index}-name`}
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
                    pregnancy_weeks: v
                      ? Math.max(0, Math.min(45, parseInt(v, 10) || 0))
                      : undefined,
                  })
                }
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                style={[styles.input, styles.weeksInput]}
                testID={`case-b-fetus-${index}-weeks`}
              />
              <Text variant="body" color="secondary">주</Text>
            </View>
          </View>

          <DateField
            label="예정일"
            value={current.due_date}
            onChange={(iso) => update({ due_date: iso })}
            futureOnly
            testID={`case-b-fetus-${index}-due-date`}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={isLast ? '다음' : `다음 아이 (${index + 2}/${total})`}
            variant="primary"
            fullWidth
            disabled={!isComplete(current) || submitting}
            onPress={onNext}
            testID="case-b-fetus-next"
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
