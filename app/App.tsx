import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export default function App() {
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const checkHealth = async () => {
    setStatus('');
    setError('');
    try {
      const res = await fetch(`${API_URL}/health`);
      const json = (await res.json()) as { status: string };
      setStatus(json.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.container} testID="root">
      <Text style={styles.title}>dear-baby</Text>
      <Button
        title="Check health"
        onPress={checkHealth}
        testID="check-health-button"
      />
      {status !== '' && (
        <Text style={styles.status} testID="health-status">
          status: {status}
        </Text>
      )}
      {error !== '' && (
        <Text style={styles.error} testID="health-error">
          error: {error}
        </Text>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: { fontSize: 24, fontWeight: '600' },
  status: { fontSize: 18, color: '#0a0' },
  error: { fontSize: 14, color: '#a00' },
});
