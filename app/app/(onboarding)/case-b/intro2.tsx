// B3 — 임신 단계 안내 (단계 인디케이터 ① 완료, ② 활성)
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

export default function CaseBIntro2Screen() {
  const router = useRouter();

  const onNext = async () => {
    await saveDraft({ lastStep: '/(onboarding)/case-b/count2' });
    router.push('/(onboarding)/case-b/count2');
  };

  return (
    <OnboardingScaffold
      caseKind={'B'}
      step={4}
      total={7}
      labelOverride={'Case B · 2단계'}
      title={'이제 임신 중인\n아이를 알려주세요'}
      subtitle={'새로 만날 아이를 위한 기록 공간을 만들어요'}
      ctaTitle={'계속하기'}
      onCta={onNext}
      testID={'onboarding-b3'}
    >
      <View style={styles.indicator}>
        <StepIndicator active={'two'} />
      </View>
      <Text variant="body" color="secondary" style={styles.note}>
        기존 아이와는 별도의 공간으로 분리해 드려요.
      </Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  indicator: { paddingVertical: spacing[6], alignItems: 'flex-start' },
  note: { textAlign: 'center', paddingVertical: spacing[6] },
});
