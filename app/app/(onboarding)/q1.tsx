// Q1: 임신 여부 (PRD-006 AC-006-01).
// docs/wireframes/onboarding.md "공통 진입 — 두 개의 독립 체크"

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { ChoiceList, OnboardingScaffold } from '../../src/components/onboarding';
import { loadDraft, saveDraft } from '../../src/onboarding/draft';

export default function Q1Screen() {
  const router = useRouter();
  const [pregnant, setPregnant] = useState<boolean | null>(null);

  useEffect(() => {
    void loadDraft().then((d) => {
      if (d.q1Pregnant !== undefined) setPregnant(d.q1Pregnant);
    });
  }, []);

  const onNext = async () => {
    if (pregnant === null) return;
    await saveDraft({ q1Pregnant: pregnant, lastStep: '/(onboarding)/q1' });
    router.push('/(onboarding)/q2');
  };

  return (
    <OnboardingScaffold
      caseKind={null}
      step={1}
      total={3}
      title={'현재 임신 중이신가요?'}
      subtitle={'맞춤 안내를 위한 첫 번째 질문'}
      ctaTitle={'다음'}
      ctaDisabled={pregnant === null}
      onCta={onNext}
      testID={'onboarding-q1'}
    >
      <ChoiceList<'yes' | 'no'>
        value={pregnant === null ? null : pregnant ? 'yes' : 'no'}
        onChange={(v) => setPregnant(v === 'yes')}
        options={[
          { value: 'yes', label: '예, 임신 중이에요', testID: 'q1-yes' },
          { value: 'no', label: '아니요', testID: 'q1-no' },
        ]}
      />
    </OnboardingScaffold>
  );
}
