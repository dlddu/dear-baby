// C2 — 양육 아이 정보 입력 (PRD-006 AC-006-04). 다자녀면 N회 반복.

import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  ChildForm,
  type ChildFormValues,
  OnboardingProgressBar,
  RepeatBadge,
} from '../../../src/components/onboarding';
import {
  loadDraft,
  updateChild,
  type ChildDraft,
} from '../../../src/onboarding/draft';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const EMPTY: ChildFormValues = {
  display_name: '',
  gender: null,
  birth_date: null,
  introduction: '',
};

function fromDraft(c: ChildDraft | undefined): ChildFormValues {
  if (!c) return EMPTY;
  return {
    display_name: c.display_name ?? '',
    gender: c.gender ?? null,
    birth_date: c.birth_date ?? null,
    introduction: c.introduction ?? '',
    photo_tmp_key: c.photo_tmp_key,
    photo_local_uri: c.photo_local_uri,
  };
}

export default function CaseCChild() {
  const router = useRouter();
  const params = useLocalSearchParams<{ index?: string }>();
  const index = Math.max(0, parseInt(params.index ?? '0', 10) || 0);
  const [values, setValues] = useState<ChildFormValues>(EMPTY);
  const [localID, setLocalID] = useState<string | null>(null);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    void (async () => {
      const draft = await loadDraft();
      const children = draft.children.filter((c) => c.kind === 'child');
      const child = children[index];
      if (child) {
        setLocalID(child.local_id);
        setValues(fromDraft(child));
      }
      setTotal(Math.max(1, children.length));
    })();
  }, [index]);

  const valid = useMemo(() => {
    return (
      values.display_name.trim().length > 0 &&
      values.gender !== null &&
      values.birth_date != null
    );
  }, [values]);

  const onContinue = async () => {
    if (!valid || !localID) return;
    await updateChild(localID, {
      kind: 'child',
      display_name: values.display_name.trim(),
      gender: values.gender ?? undefined,
      birth_date: values.birth_date ?? undefined,
      introduction: values.introduction.trim() || undefined,
      photo_tmp_key: values.photo_tmp_key,
      photo_local_uri: values.photo_local_uri,
    });
    if (index + 1 < total) {
      router.push(`/(onboarding)/case-c/child?index=${index + 1}`);
    } else {
      router.push('/(onboarding)/case-c/purpose');
    }
  };

  return (
    <CaseAccentTheme case="C">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-case-c-child">
        <OnboardingProgressBar n={2} of={3} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroRow}>
            <View style={styles.hero}>
              <Text variant="h2" color="primary" style={styles.heading}>
                아이에 대해 알려주세요
              </Text>
              <Text variant="emotion" color="secondary" style={styles.helper}>
                사진과 한줄 소개는 선택이에요. 천천히 적어 주세요.
              </Text>
            </View>
            {total > 1 ? (
              <RepeatBadge n={index + 1} of={total} testID="case-c-child-badge" />
            ) : null}
          </View>
          <ChildForm values={values} onChange={setValues} testIDPrefix="case-c-child" />
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title={index + 1 < total ? '다음 아이 정보 입력하기' : '계속하기'}
            variant="primary"
            fullWidth
            disabled={!valid}
            onPress={onContinue}
            testID="case-c-child-next"
          />
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentTheme>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  scroll: { flex: 1 },
  body: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
    gap: spacing[6],
  },
  heroRow: { gap: spacing[3] },
  hero: { gap: spacing[2] },
  heading: { textAlign: 'left' },
  helper: { textAlign: 'left' },
  footer: { paddingHorizontal: spacing[6], paddingBottom: spacing[4] },
});
