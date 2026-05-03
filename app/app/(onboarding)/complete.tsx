// Terminal screen reached only if AuthGate hasn't redirected yet (e.g.
// /me returned slowly after POST /onboarding/complete). Stays minimal so
// the user sees a friendly placeholder rather than a flash of the previous
// step before the route swap.

import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../src/components/Text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function OnboardingComplete() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-complete">
      <View style={styles.center}>
        <Text variant="emotion" color="primary" style={styles.text}>
          홈으로 데려다 드릴게요…
        </Text>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  text: { textAlign: 'center' },
});
