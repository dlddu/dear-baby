// B5 — 태아 정보 입력 (반복)
// docs/wireframes/onboarding/case-b.svg

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
import { loadDraft, saveDraft } from '../../../src/onboarding/draft';
import type { Gender } from '../../../src/api/onboarding';

export default function CaseBFetusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ idx?: string }>();
  const idx = Number(params.idx ?? '0');

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [weeks, setWeeks] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [parentingCount, setParentingCount] = useState(0);
  const [fetusTotal, setFetusTotal] = useState(1);

  useEffect(() => {
    void loadDraft().then((d) => {
      const parenting = d.children.filter((c) => c.kind === 'child');
      const fetus = d.children.filter((c) => c.kind === 'fetus');
      setParentingCount(parenting.length);
      setFetusTotal(fetus.length || 1);
      const c = fetus[idx];
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
    // Update by absolute index in the children array (parenting first).
    const draft = await loadDraft();
    const children = [...draft.children];
    const absIdx = parentingCount + idx;
    children[absIdx] = {
      ...(children[absIdx] ?? { kind: 'fetus' }),
      kind: 'fetus',
      displayName: name.trim() || undefined,
      gender: gender as Gender,
      pregnancyWeeks: Number(weeks),
      dueDate: dueDate as string,
    };
    await saveDraft({ children });
    if (idx + 1 < fetusTotal) {
      await saveDraft({ lastStep: '/(onboarding)/case-b/fetus' });
      router.push({
        pathname: '/(onboarding)/case-b/fetus',
        params: { idx: String(idx + 1) },
      });
    } else {
      await saveDraft({ lastStep: '/(onboarding)/case-b/purpose' });
      router.push('/(onboarding)/case-b/purpose');
    }
  };

  const ctaTitle =
    fetusTotal > 1 && idx + 1 < fetusTotal
      ? `다음 아이 (${idx + 2}/${fetusTotal})`
      : '다음';

  return (
    <OnboardingScaffold
      caseKind={'B'}
      step={6}
      total={7}
      labelOverride={'Case B · 2단계 ②'}
      title={'태아 정보를 알려주세요'}
      ctaTitle={ctaTitle}
      ctaDisabled={!ready}
      onCta={onNext}
      trailing={
        fetusTotal > 1 ? (
          <RepeatBadge index={idx + 1} total={fetusTotal} caseKind={'B'} />
        ) : null
      }
      testID={'onboarding-b5'}
    >
      <LabeledField label={'태명'} optional>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder={'예: 튼튼이'}
          maxLength={30}
          testID={'b5-name'}
        />
      </LabeledField>
      <LabeledField label={'성별'}>
        <GenderPicker
          value={gender}
          onChange={setGender}
          caseKind={'B'}
          testID={'b5-gender'}
        />
      </LabeledField>
      <LabeledField label={'임신 주차'}>
        <TextField
          value={weeks}
          onChangeText={(v) => setWeeks(v.replace(/\D+/g, ''))}
          placeholder={'예: 17'}
          keyboardType={'number-pad'}
          maxLength={2}
          testID={'b5-weeks'}
        />
      </LabeledField>
      <LabeledField label={'예정일'}>
        <DateField
          value={dueDate}
          onChange={setDueDate}
          minDate={new Date()}
          testID={'b5-due'}
        />
      </LabeledField>
    </OnboardingScaffold>
  );
}
