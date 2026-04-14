import { StyleSheet, View } from 'react-native';

import { Text } from '../../src/components/Text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function RecordsTab() {
  return (
    <View style={styles.container} testID="records-tab">
      <Text variant="h2" color="primary">
        기록
      </Text>
      <Text variant="caption" color="muted">
        곧 추가됩니다
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.cream,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    gap: spacing[2],
  },
});
