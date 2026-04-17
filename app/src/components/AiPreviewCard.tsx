// AiPreviewCard — Stage 2 teaser showing blurred AI-edited content so the
// user can imagine the value of the first record before writing it
// (docs/design-system/onboarding.md `#호기심유발` `#가치선경험`).
//
// Pure-RN implementation: rather than pulling in expo-blur just for a
// teaser, we mask the body text with block characters and dim opacity.
// When `blurred=false` the real `mockText` renders so the parent can
// swap to an "unblurred after first record" state later.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../theme/spacing';

import { Card } from './Card';
import { IconCircle } from './IconCircle';
import { Text } from './Text';

export type AiPreviewCardProps = {
  mockText: string;
  blurred: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// maskText replaces each non-whitespace code point with a shaded block so
// the text shape remains but the content is unreadable — mimics a blur
// without needing a native blur view.
function maskText(input: string): string {
  let out = '';
  for (const ch of input) {
    out += /\s/.test(ch) ? ch : '░';
  }
  return out;
}

export function AiPreviewCard({
  mockText,
  blurred,
  style,
  testID,
}: AiPreviewCardProps) {
  const body = blurred ? maskText(mockText) : mockText;
  return (
    <Card surface="ivory" padding="md" style={style} testID={testID}>
      <View style={styles.header}>
        <IconCircle glyph="✨" tone="ai" size={32} />
        <Text variant="h3" color="primary">
          AI 미리보기
        </Text>
      </View>
      <Text
        variant="emotion"
        color={blurred ? 'muted' : 'primary'}
        style={[styles.body, blurred && styles.bodyBlurred]}
      >
        {body}
      </Text>
      <Text variant="caption" color="muted" style={styles.footnote}>
        {blurred
          ? '기록을 남기면 AI가 이렇게 정리해드려요'
          : 'AI가 당신의 기록을 이렇게 정리했어요'}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  body: {
    marginBottom: spacing[2],
  },
  bodyBlurred: {
    opacity: 0.55,
    letterSpacing: 2,
  },
  footnote: {},
});
