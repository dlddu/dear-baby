// A1 — 임신 아이 수 (단태/다태)
// docs/wireframes/onboarding/case-a.svg

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { ChoiceList, OnboardingScaffold } from '../../../src/components/onboarding';
import {
  loadDraft,
  saveDraft,
  setChildrenLength,
} from '../../../src/onboarding/draft';

export default function CaseACountScreen() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void loadDraft().then((d) => {
      if (d.case === 'A' && d.children.length > 0) {
        setCount(d.children.length === 1 ? 1 : 2);
      }
    });
  }, []);

  const onNext = async () => {
    if (count === null) return;
    await setChildrenLength(count, 'fetus');
    await saveDraft({ lastStep: '/(onboarding)/case-a/fetus' });
    router.push({
      pathname: '/(onboarding)/case-a/fetus',
      params: { idx: '0' },
    });
  };

  return (
    <OnboardingScaffold
      caseKind={'A'}
      step={1}
      total={3}
      title={'임신 중인 아이는 몇 명인가요?'}
      subtitle={'선택 시 입력할 태아 수가 결정됩니다'}
      ctaTitle={'다음'}
      ctaDisabled={count === null}
      onCta={onNext}
      testID={'onboarding-a1'}
    >
      <ChoiceList<number>
        value={count}
        onChange={setCount}
        caseKind={'A'}
        options={[
          { value: 1, label: '단태', hint: '1명', testID: 'a1-singleton' },
          { value: 2, label: '다태', hint: '2명 이상', testID: 'a1-multiple' },
        ]}
      />
    </OnboardingScaffold>
  );
}
