// RecordQuestionHeader — record entry screens (text/voice) reuse this to
// echo the home-screen question above the input. Lightweight: a small
// week badge + h3 question. When `question` is empty/whitespace it
// renders nothing so non-home entry points (deep links, future flows)
// can mount the screen without an awkward blank header.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../theme/spacing';

import { Badge } from './Badge';
import { Text } from './Text';

export type RecordQuestionHeaderProps = {
  question: string;
  weekLabel: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function RecordQuestionHeader({
  question,
  weekLabel,
  style,
  testID,
}: RecordQuestionHeaderProps) {
  if (!question.trim()) return null;
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {weekLabel ? (
        <View style={styles.badgeRow}>
          <Badge variant="week" label={weekLabel} />
        </View>
      ) : null}
      <Text variant="h3" color="primary">
        {question}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  badgeRow: { flexDirection: 'row' },
});
