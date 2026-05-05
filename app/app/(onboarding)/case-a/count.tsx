// A1 — 임신 아이 수 (단태/다태). 와이어프레임 docs/wireframes/onboarding/case-a.svg
// 1/3.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { OnboardingScreen, SelectCard } from '../../../src/components/onboarding';
import { Text } from '../../../src/components/Text';
import { spacing } from '../../../src/theme/spacing';
import {
  loadDraft,
  resizeChildren,
  saveDraft,
} from '../../../src/onboarding/draft';

type Choice = 'single' | 'multi';

export default function CaseACount() {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | undefined>(undefined);
  const [multi, setMulti] = useState<number>(2);

  useEffect(() => {
    void loadDraft().then((d) => {
      if (d.fetus_count === 1) setChoice('single');
      if (d.fetus_count && d.fetus_count >= 2) {
        setChoice('multi');
        setMulti(d.fetus_count);
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void saveDraft({ last_step: '/case-a/count' });
    }, []),
  );

  const onNext = async () => {
    if (!choice) return;
    const count = choice === 'single' ? 1 : multi;
    await saveDraft({ fetus_count: count });
    await resizeChildren(0, count, 'fetus');
    router.push({
      pathname: '/(onboarding)/case-a/fetus',
      params: { index: '0' },
    });
  };

  return (
    <OnboardingScreen
      case="A"
      step={1}
      totalSteps={3}
      progressLabel="Case A"
      cta={{ title: '다음', onPress: onNext, disabled: !choice, testID: 'a1-next' }}
      testID="onboarding-a1"
    >
      <View style={{ gap: spacing[2] }}>
        <Text variant="h2" color="primary">
          임신 중인 아이는 몇 명인가요?
        </Text>
        <Text variant="caption" color="secondary">
          선택 시 입력할 태아 수가 결정됩니다
        </Text>
      </View>
      <View style={{ gap: spacing[3] }}>
        <SelectCard
          title="단태"
          subtitle="1명"
          selected={choice === 'single'}
          onPress={() => setChoice('single')}
          testID="a1-single"
        />
        <SelectCard
          title="다태"
          subtitle={`${multi}명 이상`}
          selected={choice === 'multi'}
          onPress={() => setChoice('multi')}
          testID="a1-multi"
        />
        {choice === 'multi' ? (
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            {[2, 3, 4].map((n) => (
              <SelectCard
                key={n}
                title={`${n}명`}
                selected={multi === n}
                onPress={() => setMulti(n)}
                testID={`a1-multi-${n}`}
              />
            ))}
          </View>
        ) : null}
      </View>
    </OnboardingScreen>
  );
}
