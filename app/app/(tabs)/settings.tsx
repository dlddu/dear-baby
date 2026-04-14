import { StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthContext';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function SettingsTab() {
  const { user, signOut } = useAuth();
  return (
    <View style={styles.container} testID="settings-tab">
      <Text variant="h2" color="primary">
        설정
      </Text>
      {user && (
        <Text variant="body" color="secondary">
          {user.email}
        </Text>
      )}
      <Button
        title="Sign out"
        variant="secondary"
        onPress={signOut}
        testID="sign-out-button"
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.cream,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    gap: spacing[4],
  },
});
