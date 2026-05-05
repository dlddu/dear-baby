// B4 — 임신 아이 수 (단태/다태). 와이어프레임 docs/wireframes/onboarding/case-b.svg.

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

type Choice = 'single' | 'multi';

export default function CaseBCount2() {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | undefined>(undefined);
  const [multi, setMulti] = useState(2);

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
      void saveDraft({ last_step: '/case-b/count2' });
    }, []),
  );

  const onNext = async () => {
    if (!choice) return;
    const fetusCount = choice === 'single' ? 1 : multi;
    const d = await loadDraft();
    const childCount = d.child_count ?? 0;
    await saveDraft({ fetus_count: fetusCount });
    // 양육 슬롯 뒤에 태아 슬롯 추가/리사이즈.
    await resizeChildren(childCount, fetusCount, 'fetus');
    router.push({
      pathname: '/(onboarding)/case-b/fetus',
      params: { index: String(childCount) },
    });
  };

  return (
    <OnboardingScreen
      case="B"
      step={5}
      totalSteps={7}
      progressLabel="Case B · 2단계 ①"
      cta={{ title: '다음', onPress: onNext, disabled: !choice, testID: 'b4-next' }}
      testID="onboarding-b4"
    >
      <Text variant="h2" color="primary">
        임신 중인 아이는 몇 명인가요?
      </Text>
      <Text variant="caption" color="secondary">
        기존 아이와 별도로 관리됩니다
      </Text>
      <View style={{ gap: spacing[3] }}>
        <SelectCard
          title="단태"
          subtitle="1명"
          selected={choice === 'single'}
          onPress={() => setChoice('single')}
          testID="b4-single"
        />
        <SelectCard
          title="다태"
          subtitle={`${multi}명 이상`}
          selected={choice === 'multi'}
          onPress={() => setChoice('multi')}
          testID="b4-multi"
        />
        {choice === 'multi' ? (
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            {[2, 3, 4].map((n) => (
              <SelectCard
                key={n}
                title={`${n}명`}
                selected={multi === n}
                onPress={() => setMulti(n)}
                testID={`b4-multi-${n}`}
              />
            ))}
          </View>
        ) : null}
      </View>
    </OnboardingScreen>
  );
}
