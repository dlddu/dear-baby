import { StyleSheet, Text, View } from 'react-native';

export default function RecordsTab() {
  return (
    <View style={styles.container} testID="records-tab">
      <Text style={styles.title}>기록</Text>
      <Text style={styles.hint}>곧 추가됩니다</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  hint: { fontSize: 14, color: '#666' },
});
