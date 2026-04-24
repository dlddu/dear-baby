// AiPreviewCard renders the AI preview in one of four states:
//
//   teaser   → first record not yet saved; shows a blurred mock so the
//              user can imagine the value of the upcoming preview.
//   loading  → first record saved, preview pending. Shows the blurred
//              placeholder + "정리하고 있어요" status copy.
//   ready    → worker delivered the preview. Shows the real text with
//              the unblurred footnote.
//   failed   → worker failed or the stream broke. Shows an error message
//              + a retry button.
//
// The card is purely presentational — the parent decides which state to
// render based on user.first_record_at, user.ai_preview, and the SSE
// connection status.

import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

import { Card } from './Card';
import { IconCircle } from './IconCircle';
import { Text } from './Text';

export type AiPreviewStatus = 'teaser' | 'loading' | 'ready' | 'failed';

export type AiPreviewCardProps = {
  status: AiPreviewStatus;
  // `content` is required in `ready`, ignored otherwise.
  content?: string | null;
  // `onRetry` is required in `failed`, ignored otherwise.
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// TEASER_MOCK is the pre-first-record placeholder. It never reaches the
// server — users see it blurred so they can imagine the finished thing.
const TEASER_MOCK = '엄마가 너를 처음 느낀 그 순간, 세상이 조금 더 따뜻해졌어.';

// maskText replaces each non-whitespace code point with a shaded block so
// the text shape remains but the content is unreadable — mimics a blur
// without a native blur view.
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

      {status === 'teaser' ? (
        <>
          <Text
            variant="emotion"
            color="muted"
            style={[styles.body, styles.bodyBlurred]}
          >
            {maskText(TEASER_MOCK)}
          </Text>
          <Text variant="caption" color="muted" style={styles.footnote}>
            기록을 남기면 AI가 이렇게 정리해드려요
          </Text>
        </>
      ) : null}

      {status === 'loading' ? (
        <>
          <Text
            variant="emotion"
            color="muted"
            style={[styles.body, styles.bodyBlurred]}
          >
            {maskText(TEASER_MOCK)}
          </Text>
          <Text variant="caption" color="muted" style={styles.footnote}>
            AI가 당신의 기록을 정리하고 있어요
          </Text>
        </>
      ) : null}

      {status === 'ready' ? (
        <>
          <Text variant="emotion" color="primary" style={styles.body}>
            {content ?? ''}
          </Text>
          <Text variant="caption" color="muted" style={styles.footnote}>
            AI가 당신의 기록을 이렇게 정리했어요
          </Text>
        </>
      ) : null}

      {status === 'failed' ? (
        <>
          <Text variant="emotion" color="muted" style={styles.body}>
            지금은 정리하기가 어려웠어요
          </Text>
          <View style={styles.retryRow}>
            <Text variant="caption" color="muted">
              잠시 뒤 다시 시도해 주세요
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              hitSlop={spacing[2]}
              testID={testID ? `${testID}-retry` : undefined}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryPressed,
              ]}
            >
              <Text variant="caption" color="primary">
                다시 시도
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
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
  retryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  retryButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.text.muted,
  },
  retryPressed: { opacity: 0.6 },
});
