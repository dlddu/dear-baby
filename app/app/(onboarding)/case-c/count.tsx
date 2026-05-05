// C1 — 양육 아이 수. 와이어프레임 docs/wireframes/onboarding/case-c.svg.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  OnboardingScreen,
  SelectCard,
} from '../../../src/components/onboarding';
import { Text } from '../../../src/components/Text';
import { spacing } from '../../../src/theme/spacing';
import {
  loadDraft,
  resizeChildren,
  saveDraft,
} from '../../../src/onboarding/draft';

export default function CaseCCount() {
  const router = useRouter();
  const [count, setCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    void loadDraft().then((d) => {
      if (d.child_count) setCount(d.child_count);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void saveDraft({ last_step: '/case-c/count' });
    }, []),
  );

  const onNext = async () => {
    if (!count) return;
    await saveDraft({ child_count: count });
    await resizeChildren(0, count, 'child');
    router.push({
      pathname: '/(onboarding)/case-c/child',
      params: { index: '0' },
    });
  };

  return (
    <OnboardingScreen
      case="C"
      step={1}
      totalSteps={3}
      progressLabel="Case C"
      cta={{ title: '다음', onPress: onNext, disabled: !count, testID: 'c1-next' }}
      testID="onboarding-c1"
    >
      <Text variant="h2" color="primary">
        양육 중인 아이가 몇 명인가요?
      </Text>
      <View style={{ gap: spacing[3] }}>
        {[1, 2, 3].map((n) => (
          <SelectCard
            key={n}
            title={n === 3 ? '3명 이상' : `${n}명`}
            selected={count === n}
            onPress={() => setCount(n)}
            testID={`c1-${n}`}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}
