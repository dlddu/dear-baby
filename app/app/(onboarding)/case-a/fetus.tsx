// A2 — 태아 정보 입력 (태명·성별·임신 주차·예정일).
// 다태일 경우 fetus_count 만큼 반복 진입한다. 화면 자체는 동일하지만
// query param `index` 로 몇 번째 태아인지 구분.

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

export default function CaseAFetus() {
  const params = useLocalSearchParams<{ index?: string }>();
  const idx = Number(params.index ?? '0');
  const router = useRouter();

  const [name, setName] = useState('');
  const [gender, setGender] = useState<ChildGender | undefined>(undefined);
  const [weeks, setWeeks] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    void loadDraft().then((d) => {
      const c = d.children[idx];
      setTotal(d.fetus_count ?? 1);
      if (!c) return;
      setName(c.display_name ?? '');
      setGender(c.gender);
      setWeeks(c.pregnancy_weeks ? String(c.pregnancy_weeks) : '');
      setDueDate(c.due_date ?? null);
    });
  }, [idx]);

  useFocusEffect(
    useCallback(() => {
      void loadDraft().then((d) => {
        // 와이어프레임에서는 last_step 을 정확한 라우트로 저장.
        d.last_step = `/case-a/fetus?index=${idx}`;
      });
    }, [idx]),
  );

  const isValid =
    gender !== undefined && weeks.trim() !== '' && Number(weeks) >= 1 && Number(weeks) <= 45 && dueDate !== null;

  const onNext = async () => {
    if (!isValid || gender === undefined) return;
    await upsertChild(idx, {
      kind: 'fetus',
      display_name: name.trim() || undefined,
      gender,
      pregnancy_weeks: Number(weeks),
      due_date: dueDate ?? undefined,
    });
    if (idx + 1 < total) {
      router.replace({
        pathname: '/(onboarding)/case-a/fetus',
        params: { index: String(idx + 1) },
      });
    } else {
      router.push('/(onboarding)/case-a/purpose');
    }
  };

  const ctaTitle = idx + 1 < total ? `다음 아이 (${idx + 2}/${total})` : '다음';

  return (
    <OnboardingScreen
      case="A"
      step={2}
      totalSteps={3}
      progressLabel="Case A"
      repeat={total > 1 ? { current: idx + 1, total } : undefined}
      cta={{ title: ctaTitle, onPress: onNext, disabled: !isValid, testID: 'a2-next' }}
      testID="onboarding-a2"
    >
      <Text variant="h2" color="primary">
        태아 정보를 알려주세요
      </Text>
      <TextField
        label="태명"
        caption="(선택)"
        value={name}
        onChangeText={setName}
        placeholder="예: 튼튼이"
        testID="a2-name"
      />
      <View style={{ gap: spacing[2] }}>
        <Text variant="caption" color="secondary">
          성별
        </Text>
        <GenderPicker value={gender} onChange={setGender} testID="a2-gender" />
      </View>
      <TextField
        label="임신 주차"
        value={weeks}
        onChangeText={(s) => setWeeks(s.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        trailing="주"
        testID="a2-weeks"
      />
      <DateField
        label="예정일"
        value={dueDate}
        onChange={setDueDate}
        minimumDate={TODAY}
        maximumDate={MAX_DUE}
        testID="a2-due-date"
      />
    </OnboardingScreen>
  );
}
