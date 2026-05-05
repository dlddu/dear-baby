// B2 — 양육 아이 정보 (반복). 사진(선택)·이름·성별·생년월일·한줄 소개.
// PRD-006 AC-006-03. 와이어프레임: docs/wireframes/onboarding/case-b.svg, B2.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  CaseHeader,
  ChildInfoForm,
} from '../../../src/components/onboarding';
import { loadDraft, saveDraft, type ChildDraft } from '../../../src/onboarding/draft';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBChild() {
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

  // Only the "child" rows are edited on this screen; fetus rows are
  // already in the draft (count=0 at this stage but the structure is
  // preserved for B5).
  const childRows = allChildren.filter((c) => c.kind === 'child');
  const total = childRows.length;
  const current = childRows[index];
  const isLast = index === total - 1;

  const update = (patch: Partial<ChildDraft>) => {
    setAllChildren((prev) => {
      let n = 0;
      return prev.map((c) => {
        if (c.kind !== 'child') return c;
        const matches = n === index;
        n += 1;
        return matches ? { ...c, ...patch } : c;
      });
    });
  };

  const isComplete = (c?: ChildDraft) =>
    !!c && !!c.display_name && !!c.gender && !!c.birth_date;

  const onNext = async () => {
    if (!isComplete(current) || submitting) return;
    setSubmitting(true);
    await saveDraft({ children: allChildren, last_step: '/case-b/child' });
    if (isLast) {
      router.push('/(onboarding)/case-b/intro2');
    } else {
      setIndex(index + 1);
    }
    setSubmitting(false);
  };

  if (!current) return null;

  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-child">
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <CaseHeader
            step={3}
            totalSteps={7}
            label="Case B · 1단계 ②"
            repeat={total > 1 ? { current: index + 1, total } : undefined}
          />
          <Text variant="h2" color="primary" style={styles.heading}>
            {ordinalKorean(index + 1)} 정보
          </Text>
          <ChildInfoForm
            value={{
              display_name: current.display_name,
              gender: current.gender,
              birth_date: current.birth_date,
              introduction: current.introduction,
              photo_local_uri: current.photo_local_uri,
              photo_tmp_key: current.photo_tmp_key,
            }}
            onChange={(patch) => update(patch)}
            testIDPrefix={`case-b-child-${index}`}
          />
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title={isLast ? '다음 단계로' : `다음 아이 (${index + 2}/${total})`}
            variant="primary"
            fullWidth
            disabled={!isComplete(current) || submitting}
            onPress={onNext}
            testID="case-b-child-next"
          />
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentTheme>
  );
}

function ordinalKorean(n: number): string {
  switch (n) {
    case 1:
      return '첫째 아이';
    case 2:
      return '둘째 아이';
    case 3:
      return '셋째 아이';
    default:
      return `${n}번째 아이`;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
    gap: spacing[5],
  },
  heading: {},
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
