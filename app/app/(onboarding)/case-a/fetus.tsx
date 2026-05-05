// A2 — 태아 정보 입력 (단태면 1회, 다태면 N회 반복)
// docs/wireframes/onboarding/case-a.svg
//
// "다태" was selected on A1 with the value 2. The PRD allows 다태 to
// represent any number ≥ 2; UI-wise we treat it as exactly 2 here
// because the wireframe doesn't define a "how many >2" picker. If a
// future PRD asks for 3+ this will need a count refinement step.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  DateField,
  GenderPicker,
  LabeledField,
  OnboardingScaffold,
  RepeatBadge,
  TextField,
} from '../../../src/components/onboarding';
import {
  loadDraft,
  saveDraft,
  updateChild,
} from '../../../src/onboarding/draft';
import type { Gender } from '../../../src/api/onboarding';
import type { ChildDraft } from '../../../src/onboarding/draft';

export default function CaseAFetusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ idx?: string }>();
  const idx = Number(params.idx ?? '0');

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [weeks, setWeeks] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    void loadDraft().then((d) => {
      setTotal(d.children.length || 1);
      const c: ChildDraft | undefined = d.children[idx];
      if (c) {
        setName(c.displayName ?? '');
        setGender(c.gender ?? null);
        setWeeks(c.pregnancyWeeks ? String(c.pregnancyWeeks) : '');
        setDueDate(c.dueDate ?? null);
      }
    });
  }, [idx]);

  const ready =
    !!gender && !!weeks && !!dueDate && !Number.isNaN(Number(weeks));

  const onNext = async () => {
    if (!ready) return;
    await updateChild(idx, {
      kind: 'fetus',
      displayName: name.trim() || undefined,
      gender: gender as Gender,
      pregnancyWeeks: Number(weeks),
      dueDate: dueDate as string,
    });
    if (idx + 1 < total) {
      await saveDraft({ lastStep: '/(onboarding)/case-a/fetus' });
      router.push({
        pathname: '/(onboarding)/case-a/fetus',
        params: { idx: String(idx + 1) },
      });
    } else {
      await saveDraft({ lastStep: '/(onboarding)/case-a/purpose' });
      router.push('/(onboarding)/case-a/purpose');
    }
  };

  const ctaTitle =
    total > 1 && idx + 1 < total ? `다음 아이 (${idx + 2}/${total})` : '다음';

  return (
    <OnboardingScaffold
      caseKind={'A'}
      step={2}
      total={3}
      title={'태아 정보를 알려주세요'}
      ctaTitle={ctaTitle}
      ctaDisabled={!ready}
      onCta={onNext}
      trailing={
        total > 1 ? (
          <RepeatBadge index={idx + 1} total={total} caseKind={'A'} />
        ) : null
      }
      testID={'onboarding-a2'}
    >
      <LabeledField label={'태명'} optional>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder={'예: 튼튼이'}
          maxLength={30}
          testID={'a2-name'}
        />
      </LabeledField>
      <LabeledField label={'성별'}>
        <GenderPicker
          value={gender}
          onChange={setGender}
          caseKind={'A'}
          testID={'a2-gender'}
        />
      </LabeledField>
      <LabeledField label={'임신 주차'}>
        <TextField
          value={weeks}
          onChangeText={(v) => setWeeks(v.replace(/\D+/g, ''))}
          placeholder={'예: 17'}
          keyboardType={'number-pad'}
          maxLength={2}
          testID={'a2-weeks'}
        />
      </LabeledField>
      <LabeledField label={'예정일'}>
        <DateField
          value={dueDate}
          onChange={setDueDate}
          minDate={new Date()}
          testID={'a2-due'}
        />
      </LabeledField>
    </OnboardingScaffold>
  );
}
