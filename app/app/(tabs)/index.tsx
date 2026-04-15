import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

// Home tab — follows the "Greeting → CTA → Daily Prompt" layout defined in
// docs/design-system/patterns.md. The Dual CTA (🎙 / ✏️) in particular is
// the on-ramp for PRD-001 (voice diary): `AC-001-01` (voice recording)
// and `AC-001-04` (text direct input) share this entry point so the user
// sees both options side-by-side.
export default function HomeTab() {
  const router = useRouter();

  return (
    <View style={styles.container} testID="home-tab">
      <Text variant="h1" color="primary">
        반가워요, 엄마 🌷
      </Text>
      <Text variant="emotion" color="secondary" style={styles.greeting}>
        아기를 기다리는 소중한 시간, 함께 기록해볼까요?
      </Text>

      <View style={styles.ctaRow}>
        <View style={styles.ctaItem}>
          <Button
            title="음성으로 기록"
            leading="🎙"
            onPress={() => router.push('/record/voice')}
            fullWidth
            testID="home-cta-voice"
          />
        </View>
        <View style={styles.ctaItem}>
          <Button
            title="텍스트로 작성"
            leading="✏️"
            variant="secondary"
            onPress={() => router.push('/record/text')}
            fullWidth
            testID="home-cta-text"
          />
        </View>
      </View>

      <Card surface="cream" style={styles.prompt} testID="home-daily-prompt">
        <View style={styles.promptHeader}>
          <Text variant="caption" color="secondary">
            오늘의 질문
          </Text>
          <Badge label="첫 기록이 소중해요" variant="secondary" />
        </View>
        <Text variant="h3" color="primary" style={styles.promptQuestion}>
          오늘 아기에게 가장{'\n'}해주고 싶은 말은?
        </Text>
        <Text variant="caption" color="muted">
          말하기만 해도 AI가 글로 옮겨드려요 ✨
        </Text>
      </Card>
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
  ctaRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  ctaItem: { flex: 1 },
  prompt: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptQuestion: {
    lineHeight: 26,
  },
});
