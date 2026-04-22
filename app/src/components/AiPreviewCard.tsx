// AiPreviewCard — Stage 2 AI-edit preview card. Four states:
//  - 'teaser':  user hasn't saved a first record yet. Blurred block glyphs +
//               "기록을 남기면 AI가 이렇게 정리해드려요".
//  - 'loading': first record saved, waiting on the worker. Animated ellipsis
//               + "AI가 정리하는 중이에요".
//  - 'ready':   ai_preview populated. Real text + footnote.
//  - 'failed':  worker error or SSE disconnect. Retry button surfaced.
//
// Pure-RN implementation: rather than pulling in expo-blur just for a
// teaser, we mask the body text with block characters and dim opacity.

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

import { Card } from './Card';
import { IconCircle } from './IconCircle';
import { Text } from './Text';

export type AiPreviewStatus = 'teaser' | 'loading' | 'ready' | 'failed';

export type AiPreviewCardProps = {
  status: AiPreviewStatus;
  content?: string | null;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const TEASER_MOCK = '엄마가 너를 처음 느낀 그 순간, 세상이 조금 더 따뜻해졌어.';

function maskText(input: string): string {
  let out = '';
  for (const ch of input) {
    out += /\s/.test(ch) ? ch : '░';
  }
  return out;
}

export function AiPreviewCard({
  status,
  content,
  onRetry,
  style,
  testID,
}: AiPreviewCardProps) {
  return (
    <Card surface="ivory" padding="md" style={style} testID={testID}>
      <View style={styles.header}>
        <IconCircle glyph="✨" tone="ai" size={32} />
        <Text variant="h3" color="primary">
          AI 미리보기
        </Text>
      </View>
      {renderBody(status, content)}
      {renderFootnote(status, onRetry)}
    </Card>
  );
}

function renderBody(status: AiPreviewStatus, content?: string | null) {
  switch (status) {
    case 'ready':
      return (
        <Text variant="emotion" color="primary" style={styles.body}>
          {content ?? ''}
        </Text>
      );
    case 'loading':
      return (
        <Text variant="emotion" color="muted" style={styles.body}>
          ✨ ✨ ✨
        </Text>
      );
    case 'failed':
      return (
        <Text variant="emotion" color="muted" style={styles.body}>
          —
        </Text>
      );
    case 'teaser':
    default:
      return (
        <Text
          variant="emotion"
          color="muted"
          style={[styles.body, styles.bodyBlurred]}
        >
          {maskText(TEASER_MOCK)}
        </Text>
      );
  }
}

function renderFootnote(status: AiPreviewStatus, onRetry?: () => void) {
  switch (status) {
    case 'ready':
      return (
        <Text variant="caption" color="muted">
          AI가 당신의 기록을 이렇게 정리했어요
        </Text>
      );
    case 'loading':
      return (
        <Text variant="caption" color="muted">
          AI가 정리하는 중이에요
        </Text>
      );
    case 'failed':
      return (
        <View style={styles.footRow}>
          <Text variant="caption" color="muted">
            AI 정리에 실패했어요
          </Text>
          {onRetry ? (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={({ pressed }) => [
                styles.retry,
                pressed && styles.retryPressed,
              ]}
              testID="home-ai-preview-retry"
            >
              <Text variant="caption" color="primary">
                다시 시도
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    case 'teaser':
    default:
      return (
        <Text variant="caption" color="muted">
          기록을 남기면 AI가 이렇게 정리해드려요
        </Text>
      );
  }
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
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  retry: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.text.muted,
  },
  retryPressed: { opacity: 0.6 },
});
