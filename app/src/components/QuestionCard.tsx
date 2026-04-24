// QuestionCard — the Stage 2 home-screen prompt card
// (docs/design-system/onboarding.md). Layout:
//   [week badge]  (only when dueDate is known)
//   question text (h3)
//   soft encouragement (emotion, secondary)

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../theme/spacing';

import { Badge } from './Badge';
import { Card } from './Card';
import { Text } from './Text';

export type QuestionCardProps = {
  weekLabel: string | null;
  question: string;
  encouragement: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  badgeTestID?: string;
};

export function QuestionCard({
  weekLabel,
  question,
  encouragement,
  style,
  testID,
  badgeTestID,
}: QuestionCardProps) {
  return (
    <Card surface="cream" padding="lg" style={style} testID={testID}>
      {weekLabel ? (
        <View style={styles.badgeRow}>
          <Badge variant="week" label={weekLabel} testID={badgeTestID} />
        </View>
      ) : null}
      <Text variant="h3" color="primary" style={styles.question}>
        {question}
      </Text>
      <Text variant="emotion" color="secondary" style={styles.encouragement}>
        {encouragement}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  badgeRow: { marginBottom: spacing[3] },
  question: { marginBottom: spacing[3] },
  encouragement: {},
});
