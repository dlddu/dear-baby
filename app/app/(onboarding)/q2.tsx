// Q2 — 양육 여부 체크 (와이어프레임 docs/wireframes/onboarding/common.svg).
// Q1 + Q2 의 조합으로 케이스를 결정하고 해당 케이스 첫 화면으로 이동한다.
//
//   임신 O · 양육 X → Case A
//   임신 O · 양육 O → Case B
//   임신 X · 양육 O → Case C
//   임신 X · 양육 X → 양해 카피 + Case A 안내 (PRD 명세)

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { OnboardingScreen, SelectCard } from '../../src/components/onboarding';
import { Text } from '../../src/components/Text';
import { spacing } from '../../src/theme/spacing';
import { loadDraft, saveDraft } from '../../src/onboarding/draft';

import type { OnboardingCase } from '../../src/api/onboarding';

function decideCase(pregnant: boolean, parenting: boolean): OnboardingCase {
  if (pregnant && parenting) return 'B';
  if (parenting) return 'C';
  // 임신 O · 양육 X 또는 임신 X · 양육 X → Case A로 안내
  return 'A';
}

export default function OnboardingQ2() {
  const router = useRouter();
  const [pregnant, setPregnant] = useState<boolean | undefined>(undefined);
  const [parenting, setParenting] = useState<boolean | undefined>(undefined);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    void loadDraft().then((d) => {
      setPregnant(d.q1_pregnant);
      setParenting(d.q2_parenting);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void saveDraft({ last_step: '/q2' });
    }, []),
  );

  const onNext = async () => {
    if (parenting === undefined || pregnant === undefined) return;
    if (!pregnant && !parenting && !showFallback) {
      // PRD: 임신X·양육X 조합은 양해 카피를 한 번 보여주고, 사용자가 다시
      // "다음"을 누르면 Case A 흐름으로 진입시킨다.
      setShowFallback(true);
      return;
    }
    const c = decideCase(pregnant, parenting);
    await saveDraft({ q2_parenting: parenting, case: c });
    if (c === 'A') router.push('/(onboarding)/case-a/count');
    if (c === 'B') router.push('/(onboarding)/case-b/intro1');
    if (c === 'C') router.push('/(onboarding)/case-c/count');
  };

  return (
    <OnboardingScreen
      step={2}
      totalSteps={3}
      cta={{
        title: showFallback ? 'Case A 흐름으로 이동' : '다음',
        onPress: onNext,
        disabled: parenting === undefined,
        testID: 'q2-next',
      }}
      testID="onboarding-q2"
    >
      <View style={{ gap: spacing[2] }}>
        <Text variant="h2" color="primary">
          이미 태어난 아이가 있나요?
        </Text>
        <Text variant="body" color="secondary">
          현재 양육 중인 아이를 알려주세요
        </Text>
      </View>
      <View style={{ gap: spacing[3] }}>
        <SelectCard
          title="예, 양육 중이에요"
          selected={parenting === true}
          onPress={() => {
            setParenting(true);
            setShowFallback(false);
          }}
          testID="q2-yes"
        />
        <SelectCard
          title="아니요"
          selected={parenting === false}
          onPress={() => {
            setParenting(false);
            setShowFallback(false);
          }}
          testID="q2-no"
        />
      </View>
      {showFallback ? (
        <View style={{ gap: spacing[2] }}>
          <Text variant="body" color="primary">
            아직 임신·양육 중이 아니시군요.
          </Text>
          <Text variant="body" color="secondary">
            앞으로 만날 아기를 위한 흐름으로 안내해 드릴게요. 다시 "다음"을 눌러
            계속 진행해주세요.
          </Text>
        </View>
      ) : null}
    </OnboardingScreen>
  );
}
