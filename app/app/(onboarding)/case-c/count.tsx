// C1 — 양육 아이 수 (1명 / 2명 / 3명 이상)
// docs/wireframes/onboarding/case-c.svg

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { ChoiceList, OnboardingScaffold } from '../../../src/components/onboarding';
import {
  loadDraft,
  saveDraft,
  setChildrenLength,
} from '../../../src/onboarding/draft';

export default function CaseCCountScreen() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void loadDraft().then((d) => {
      if (d.case === 'C' && d.children.length > 0) {
        setCount(Math.min(3, d.children.length));
      }
    });
  }, []);

  const onNext = async () => {
    if (count === null) return;
    await setChildrenLength(count, 'child');
    await saveDraft({ lastStep: '/(onboarding)/case-c/child' });
    router.push({
      pathname: '/(onboarding)/case-c/child',
      params: { idx: '0' },
    });
  };

  return (
    <OnboardingScaffold
      caseKind={'C'}
      step={1}
      total={3}
      title={'양육 중인 아이가 몇 명인가요?'}
      ctaTitle={'다음'}
      ctaDisabled={count === null}
      onCta={onNext}
      testID={'onboarding-c1'}
    >
      <ChoiceList<number>
        value={count}
        onChange={setCount}
        caseKind={'C'}
        options={[
          { value: 1, label: '1명', testID: 'c1-one' },
          { value: 2, label: '2명', testID: 'c1-two' },
          { value: 3, label: '3명 이상', testID: 'c1-many' },
        ]}
      />
    </OnboardingScaffold>
  );
}
