// B5 — 태아 정보 (반복). Case A 의 fetus 화면과 동일한 입력 필드를 쓴다.

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  DateField,
  GenderPicker,
  OnboardingScreen,
  TextField,
} from '../../../src/components/onboarding';
import { Text } from '../../../src/components/Text';
import { spacing } from '../../../src/theme/spacing';
import {
  loadDraft,
  upsertChild,
} from '../../../src/onboarding/draft';

import type { ChildGender } from '../../../src/api/onboarding';

const TODAY = new Date();
const MAX_DUE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7 * 45);
  return d;
})();

export default function CaseBFetus() {
  const params = useLocalSearchParams<{ index?: string }>();
  const idx = Number(params.index ?? '0');
  const router = useRouter();

  const [name, setName] = useState('');
  const [gender, setGender] = useState<ChildGender | undefined>(undefined);
  const [weeks, setWeeks] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [childCount, setChildCount] = useState(0);
  const [fetusTotal, setFetusTotal] = useState(1);

  useEffect(() => {
    void loadDraft().then((d) => {
      setChildCount(d.child_count ?? 0);
      setFetusTotal(d.fetus_count ?? 1);
      const c = d.children[idx];
      if (!c) return;
      setName(c.display_name ?? '');
      setGender(c.gender);
      setWeeks(c.pregnancy_weeks ? String(c.pregnancy_weeks) : '');
      setDueDate(c.due_date ?? null);
    });
  }, [idx]);

  useFocusEffect(
    useCallback(() => {
      void loadDraft();
    }, [idx]),
  );

  const fetusIndex = idx - childCount; // 0-based among fetuses
  const isValid =
    gender !== undefined &&
    weeks.trim() !== '' &&
    Number(weeks) >= 1 &&
    Number(weeks) <= 45 &&
    dueDate !== null;

  const onNext = async () => {
    if (!isValid || gender === undefined) return;
    await upsertChild(idx, {
      kind: 'fetus',
      display_name: name.trim() || undefined,
      gender,
      pregnancy_weeks: Number(weeks),
      due_date: dueDate ?? undefined,
    });
    if (fetusIndex + 1 < fetusTotal) {
      router.replace({
        pathname: '/(onboarding)/case-b/fetus',
        params: { index: String(idx + 1) },
      });
    } else {
      router.push('/(onboarding)/case-b/purpose');
    }
  };

  const ctaTitle =
    fetusIndex + 1 < fetusTotal ? `다음 아이 (${fetusIndex + 2}/${fetusTotal})` : '다음';

  return (
    <OnboardingScreen
      case="B"
      step={6}
      totalSteps={7}
      progressLabel="Case B · 2단계 ②"
      repeat={fetusTotal > 1 ? { current: fetusIndex + 1, total: fetusTotal } : undefined}
      cta={{ title: ctaTitle, onPress: onNext, disabled: !isValid, testID: 'b5-next' }}
      testID="onboarding-b5"
    >
      <Text variant="h2" color="primary">
        태아 정보
      </Text>
      <TextField
        label="태명"
        caption="(선택)"
        value={name}
        onChangeText={setName}
        placeholder="예: 튼튼이"
        testID="b5-name"
      />
      <View style={{ gap: spacing[2] }}>
        <Text variant="caption" color="secondary">
          성별
        </Text>
        <GenderPicker value={gender} onChange={setGender} testID="b5-gender" />
      </View>
      <TextField
        label="임신 주차"
        value={weeks}
        onChangeText={(s) => setWeeks(s.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        trailing="주"
        testID="b5-weeks"
      />
      <DateField
        label="예정일"
        value={dueDate}
        onChange={setDueDate}
        minimumDate={TODAY}
        maximumDate={MAX_DUE}
        testID="b5-due-date"
      />
    </OnboardingScreen>
  );
}
