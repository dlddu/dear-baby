// C3 — 기록 목적 (복수 선택). 모든 아이에 동일 목적을 복제 저장한다.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '../../../src/auth/AuthContext';
import {
  Checkbox,
  OnboardingScreen,
  SelectCard,
} from '../../../src/components/onboarding';
import { Text } from '../../../src/components/Text';
import { spacing } from '../../../src/theme/spacing';
import {
  clearDraft,
  loadDraft,
  saveDraft,
} from '../../../src/onboarding/draft';
import { buildSubmission } from '../../../src/onboarding/submit';

import type { RecordPurpose } from '../../../src/api/onboarding';

const OPTIONS: Array<{ value: RecordPurpose; title: string }> = [
  { value: 'book_making', title: '아이에게 줄 책 만들기' },
  { value: 'memory_keeping', title: '성장 일기' },
  { value: 'family_share', title: '가족과 공유' },
  { value: 'emotion_diary', title: '육아 회고' },
];

export default function CaseCPurpose() {
  const router = useRouter();
  const { submitCaseOnboarding } = useAuth();

  const [selected, setSelected] = useState<RecordPurpose[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDraft().then((d) => {
      const first = d.children[0];
      if (first?.purposes) setSelected(first.purposes);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void saveDraft({ last_step: '/case-c/purpose' });
    }, []),
  );

  const toggle = (p: RecordPurpose) => {
    setSelected((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    );
  };

  const onSubmit = async () => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const draft = await loadDraft();
      const payload = buildSubmission(draft, selected);
      await submitCaseOnboarding(payload);
      await clearDraft();
    } catch (e) {
      setError('지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScreen
      case="C"
      step={3}
      totalSteps={3}
      progressLabel="Case C"
      cta={{
        title: submitting ? '저장 중…' : '홈으로 시작하기',
        onPress: onSubmit,
        disabled: selected.length === 0 || submitting,
        testID: 'c3-submit',
      }}
      errorMessage={error ?? undefined}
      testID="onboarding-c3"
    >
      <View style={{ gap: spacing[2] }}>
        <Text variant="h2" color="primary">
          어떤 마음으로 기록을 남기고 싶나요?
        </Text>
        <Text variant="caption" color="secondary">
          복수 선택 가능
        </Text>
      </View>
      <View style={{ gap: spacing[3] }}>
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.value}
            title={opt.title}
            selected={selected.includes(opt.value)}
            onPress={() => toggle(opt.value)}
            leading={<Checkbox checked={selected.includes(opt.value)} />}
            testID={`c3-${opt.value}`}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}
