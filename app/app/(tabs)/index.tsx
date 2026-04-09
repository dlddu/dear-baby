import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthContext';

export default function HomeTab() {
  const { user } = useAuth();
  return (
    <View style={styles.container} testID="home-tab">
      <Text style={styles.title}>홈</Text>
      {user && <Text style={styles.hello}>Hello, {user.name || user.email}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  hello: { fontSize: 16, color: '#333' },
});
