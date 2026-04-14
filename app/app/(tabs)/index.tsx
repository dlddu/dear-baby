import { StyleSheet, View } from 'react-native';

import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthContext';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function HomeTab() {
  const { user } = useAuth();
  return (
    <View style={styles.container} testID="home-tab">
      <Text variant="h1" color="primary">
        반가워요, 엄마 🌷
      </Text>
      <Text variant="emotion" color="secondary" style={styles.greeting}>
        아기를 기다리는 소중한 시간, 함께 기록해볼까요?
      </Text>
      {user && (
        <Text variant="caption" color="muted">
          {user.name || user.email}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.cream,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    gap: spacing[3],
  },
  greeting: { marginBottom: spacing[2] },
});
