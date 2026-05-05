// C2 — 양육 아이 정보 입력 (반복). 사진(선택)·이름·성별·생년월일·한줄 소개.
// PRD-006 AC-006-04. 와이어프레임: docs/wireframes/onboarding/case-c.svg, C2.

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

export default function CaseCChild() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildDraft[]>([]);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      setChildren(d.children.filter((c) => c.kind === 'child'));
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
    !!c && !!c.display_name && !!c.gender && !!c.birth_date;

  const onNext = async () => {
    if (!isComplete(current) || submitting) return;
    setSubmitting(true);
    await saveDraft({ children, last_step: '/case-c/child' });
    if (isLast) {
      router.push('/(onboarding)/case-c/purpose');
    } else {
      setIndex(index + 1);
    }
    setSubmitting(false);
  };

  if (!current) return null;

  const ordinalLabel = total === 1 ? '아이' : ordinalKorean(index + 1);

  return (
    <CaseAccentTheme case="C">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-c-child">
        <ScrollView contentContainerStyle={styles.container}>
          <CaseHeader
            step={2}
            totalSteps={3}
            label="Case C · 2/3"
            repeat={total > 1 ? { current: index + 1, total } : undefined}
          />
          <Text variant="h2" color="primary" style={styles.heading}>
            {ordinalLabel} 정보를 알려주세요
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
            testIDPrefix={`case-c-child-${index}`}
          />
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title={isLast ? '다음' : `다음 아이 (${index + 2}/${total})`}
            variant="primary"
            fullWidth
            disabled={!isComplete(current) || submitting}
            onPress={onNext}
            testID="case-c-child-next"
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
  heading: { marginBottom: spacing[2] },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
