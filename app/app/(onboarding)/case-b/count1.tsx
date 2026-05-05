// B1 — 양육 아이 수 (1명/2명/3명 이상). 와이어프레임 docs/wireframes/onboarding/case-b.svg.

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

export default function CaseBCount1() {
  const router = useRouter();
  const [count, setCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    void loadDraft().then((d) => {
      if (d.child_count) setCount(d.child_count);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void saveDraft({ last_step: '/case-b/count1' });
    }, []),
  );

  const onNext = async () => {
    if (!count) return;
    await saveDraft({ child_count: count });
    // 양육 아이를 children[0..count) 슬롯에, 태아는 그 이후 슬롯에.
    await resizeChildren(0, count, 'child');
    router.push({
      pathname: '/(onboarding)/case-b/child',
      params: { index: '0' },
    });
  };

  return (
    <OnboardingScreen
      case="B"
      step={2}
      totalSteps={7}
      progressLabel="Case B · 1단계 ①"
      cta={{ title: '다음', onPress: onNext, disabled: !count, testID: 'b1-next' }}
      testID="onboarding-b1"
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
            testID={`b1-${n}`}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}
