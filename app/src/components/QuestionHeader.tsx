// QuestionHeader — onboarding/question-screen 헤더.
// docs/mockups/source/src/components/Common.tsx 의 QuestionHeader 를 RN 으로 옮긴 것.
//
// 구성: (선택) eyebrow 라벨 → serif 타이틀 → (선택) helper 카피.
// 타이틀은 정서적 무게를 위해 serif 토큰(`h2Serif`) 을 사용.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../theme/spacing';

import { Text } from './Text';

export type QuestionHeaderProps = {
  eyebrow?: string;
  title: string;
  helper?: string;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function QuestionHeader({
  eyebrow,
  title,
  helper,
  centered = false,
  style,
  testID,
}: QuestionHeaderProps) {
  const align: ViewStyle = centered
    ? { alignItems: 'center' }
    : { alignItems: 'flex-start' };
  const textAlign = centered ? 'center' : 'left';
  return (
    <View style={[styles.wrap, align, style]} testID={testID}>
      {eyebrow ? (
        <Text
          variant="badge"
          color="coral"
          style={[styles.eyebrow, { textAlign }]}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text variant="h2Serif" color="primary" style={{ textAlign }}>
        {title}
      </Text>
      {helper ? (
        <Text
          variant="body"
          color="secondary"
          style={[styles.helper, { textAlign }]}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  eyebrow: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  helper: {
    fontSize: 14,
    lineHeight: 22,
  },
});
