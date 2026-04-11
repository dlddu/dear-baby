import { Button, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthContext';

export default function SettingsTab() {
  const { user, signOut } = useAuth();
  return (
    <View style={styles.container} testID="settings-tab">
      <Text style={styles.title}>설정</Text>
      {user && <Text style={styles.email}>{user.email}</Text>}
      <Button title="Sign out" onPress={signOut} testID="sign-out-button" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  email: { fontSize: 14, color: '#555' },
});
