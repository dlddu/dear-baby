// B4 — 임신 아이 수 (단태/다태)
// docs/wireframes/onboarding/case-b.svg

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { ChoiceList, OnboardingScaffold } from '../../../src/components/onboarding';
import { loadDraft, saveDraft } from '../../../src/onboarding/draft';

export default function CaseBCount2Screen() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void loadDraft().then((d) => {
      const existing = d.children.filter((c) => c.kind === 'fetus').length;
      if (existing > 0) setCount(existing >= 2 ? 2 : 1);
    });
  }, []);

  const onNext = async () => {
    if (count === null) return;
    // Append `count` fetus children after the existing parenting ones.
    const draft = await loadDraft();
    const parenting = draft.children.filter((c) => c.kind === 'child');
    const existingFetus = draft.children.filter((c) => c.kind === 'fetus');
    const fetus = existingFetus.slice(0, count);
    while (fetus.length < count) fetus.push({ kind: 'fetus' });
    await saveDraft({
      children: [...parenting, ...fetus],
      lastStep: '/(onboarding)/case-b/fetus',
    });
    router.push({
      pathname: '/(onboarding)/case-b/fetus',
      params: { idx: '0' },
    });
  };

  return (
    <OnboardingScaffold
      caseKind={'B'}
      step={5}
      total={7}
      labelOverride={'Case B · 2단계 ①'}
      title={'임신 중인 아이는 몇 명인가요?'}
      subtitle={'기존 아이와 별도로 관리됩니다'}
      ctaTitle={'다음'}
      ctaDisabled={count === null}
      onCta={onNext}
      testID={'onboarding-b4'}
    >
      <ChoiceList<number>
        value={count}
        onChange={setCount}
        caseKind={'B'}
        options={[
          { value: 1, label: '단태', hint: '1명', testID: 'b4-singleton' },
          { value: 2, label: '다태', hint: '2명 이상', testID: 'b4-multiple' },
        ]}
      />
    </OnboardingScaffold>
  );
}
