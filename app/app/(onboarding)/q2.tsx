// Q2: 양육 여부 (PRD-006 AC-006-01). The Q1+Q2 answers decide which
// case the user enters:
//
//   임신 O · 양육 X → Case A
//   임신 O · 양육 O → Case B
//   임신 X · 양육 O → Case C
//   임신 X · 양육 X → Case A with apologetic copy (PRD says "양해")
//
// docs/wireframes/onboarding.md "공통 진입 — 두 개의 독립 체크"

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../src/components/Text';
import { ChoiceList, OnboardingScaffold } from '../../src/components/onboarding';
import {
  loadDraft,
  saveDraft,
  setChildrenLength,
} from '../../src/onboarding/draft';
import type { CaseKind, ChildKind } from '../../src/api/onboarding';
import { spacing } from '../../src/theme/spacing';

function decideCase(q1: boolean, q2: boolean): CaseKind {
  if (q1 && !q2) return 'A';
  if (q1 && q2) return 'B';
  if (!q1 && q2) return 'C';
  return 'A'; // 임신 X · 양육 X — fall through to Case A per PRD
}

function firstRoute(c: CaseKind): string {
  switch (c) {
    case 'A':
      return '/(onboarding)/case-a/count';
    case 'B':
      return '/(onboarding)/case-b/intro1';
    case 'C':
      return '/(onboarding)/case-c/count';
  }
}

function defaultKindForCase(c: CaseKind): ChildKind {
  return c === 'C' ? 'child' : 'fetus';
}

export default function Q2Screen() {
  const router = useRouter();
  const [parenting, setParenting] = useState<boolean | null>(null);
  const [q1, setQ1] = useState<boolean | null>(null);

  useEffect(() => {
    void loadDraft().then((d) => {
      setQ1(d.q1Pregnant ?? null);
      if (d.q2Parenting !== undefined) setParenting(d.q2Parenting);
    });
  }, []);

  const showApology = q1 === false && parenting === false;

  const onNext = async () => {
    if (parenting === null || q1 === null) return;
    const decided = decideCase(q1, parenting);
    // Reset children list so navigating back/forward doesn't reuse a
    // mismatched kind from a previous case attempt.
    await setChildrenLength(0, defaultKindForCase(decided));
    await saveDraft({
      q2Parenting: parenting,
      case: decided,
      lastStep: firstRoute(decided),
    });
    router.push(firstRoute(decided));
  };

  return (
    <OnboardingScaffold
      caseKind={null}
      step={2}
      total={3}
      title={'이미 태어난 아이가 있나요?'}
      subtitle={'현재 양육 중인 아이를 알려주세요'}
      ctaTitle={'다음'}
      ctaDisabled={parenting === null || q1 === null}
      onCta={onNext}
      testID={'onboarding-q2'}
    >
      <ChoiceList<'yes' | 'no'>
        value={parenting === null ? null : parenting ? 'yes' : 'no'}
        onChange={(v) => setParenting(v === 'yes')}
        options={[
          { value: 'yes', label: '예, 양육 중이에요', testID: 'q2-yes' },
          { value: 'no', label: '아니요', testID: 'q2-no' },
        ]}
      />
      {showApology ? (
        <View style={styles.apology}>
          <Text variant="caption" color="secondary" style={styles.apologyText}>
            아직 임신 계획 중이시군요. 나중에 더 잘 맞는 흐름을
            준비할게요. 우선 임신 정보를 임시로 입력해 두시면, 곧 만날
            아이를 위한 기록 공간을 함께 시작해볼 수 있어요.
          </Text>
        </View>
      ) : null}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  apology: { paddingTop: spacing[4] },
  apologyText: { lineHeight: 20 },
});
