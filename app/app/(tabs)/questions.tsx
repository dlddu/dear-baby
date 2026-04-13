import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../src/theme/colors';

export default function QuestionsTab() {
  return (
    <View style={styles.container} testID="questions-tab">
      <Text style={styles.title}>질문</Text>
      <Text style={styles.hint}>곧 추가됩니다</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.bgCream,
  },
  title: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },
  hint: { fontSize: 14, color: colors.textSecondary },
});
