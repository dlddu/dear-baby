// B0 — 양육 단계 안내 (단계 인디케이터 ① 활성)
// docs/wireframes/onboarding/case-b.svg

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  OnboardingScaffold,
  StepIndicator,
} from '../../../src/components/onboarding';
import { Text } from '../../../src/components/Text';
import { saveDraft } from '../../../src/onboarding/draft';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBIntro1Screen() {
  const router = useRouter();

  const onNext = async () => {
    await saveDraft({ lastStep: '/(onboarding)/case-b/count1' });
    router.push('/(onboarding)/case-b/count1');
  };

  return (
    <OnboardingScaffold
      caseKind={'B'}
      step={1}
      total={7}
      labelOverride={'Case B · 1단계'}
      title={'양육 중인 아이를\n먼저 알려주세요'}
      subtitle={'이미 함께 자란 아이부터 차근차근 입력해요'}
      ctaTitle={'시작하기'}
      onCta={onNext}
      testID={'onboarding-b0'}
    >
      <View style={styles.indicator}>
        <StepIndicator active={'one'} />
      </View>
      <Text variant="body" color="secondary" style={styles.note}>
        한 명씩 차례로 진행할게요. 사진은 선택이에요.
      </Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  indicator: { paddingVertical: spacing[6], alignItems: 'flex-start' },
  note: { textAlign: 'center', paddingVertical: spacing[6] },
});
