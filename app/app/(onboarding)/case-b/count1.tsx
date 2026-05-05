// B1 — 양육 아이 수
// docs/wireframes/onboarding/case-b.svg
//
// Note on draft layout: Case B keeps parenting children at the start
// of the children array and fetus children after them. count1 sets the
// number of leading parenting children; count2 will append fetus
// children.

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { ChoiceList, OnboardingScaffold } from '../../../src/components/onboarding';
import { loadDraft, saveDraft } from '../../../src/onboarding/draft';

export default function CaseBCount1Screen() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void loadDraft().then((d) => {
      const existing = d.children.filter((c) => c.kind === 'child').length;
      if (existing > 0) setCount(Math.min(3, existing));
    });
  }, []);

  const onNext = async () => {
    if (count === null) return;
    const draft = await loadDraft();
    // Keep any existing parenting drafts up to count, append blanks if
    // needed, drop fetus drafts (they'll be re-inserted by count2).
    const existingChildren = draft.children
      .filter((c) => c.kind === 'child')
      .slice(0, count);
    while (existingChildren.length < count) {
      existingChildren.push({ kind: 'child' });
    }
    await saveDraft({
      children: existingChildren,
      lastStep: '/(onboarding)/case-b/child',
    });
    router.push({
      pathname: '/(onboarding)/case-b/child',
      params: { idx: '0' },
    });
  };

  return (
    <OnboardingScaffold
      caseKind={'B'}
      step={2}
      total={7}
      labelOverride={'Case B · 1단계 ①'}
      title={'양육 중인 아이가 몇 명인가요?'}
      ctaTitle={'다음'}
      ctaDisabled={count === null}
      onCta={onNext}
      testID={'onboarding-b1'}
    >
      <ChoiceList<number>
        value={count}
        onChange={setCount}
        caseKind={'B'}
        options={[
          { value: 1, label: '1명', testID: 'b1-one' },
          { value: 2, label: '2명', testID: 'b1-two' },
          { value: 3, label: '3명 이상', testID: 'b1-many' },
        ]}
      />
    </OnboardingScaffold>
  );
}
