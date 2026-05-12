import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../src/components/Text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function CommunityTab() {
  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="community-tab">
      <Text variant="h2" color="primary">
        커뮤니티
      </Text>
      <Text variant="caption" color="muted">
        곧 추가됩니다
      </Text>
    </SafeAreaView>
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
