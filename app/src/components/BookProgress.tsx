// BookProgress — PRD-007 AC-007-07 의 책 진행도 영역.
//
// 시각 출처: docs/mockups/source/src/screens/HomePregnancyScreen.tsx L82-94
// (책 진행도 섹션). mockup 의 `mt-3.5 pt-3 border-t border-beige/60` 와 동일하게,
// 카드 chrome (bg/shadow/radius) 없이 hairline 으로 구분된 좁은 섹션으로
// 렌더된다 — HomeQuestionCard 의 `footer` 슬롯에 넣으면 1인칭 카드 하단의
// hairline 구분 영역으로 자연스럽게 결합된다.
//
// 두 상태:
//   - `count < threshold` (기본 50): 진행 텍스트 + (?) 도움말 버튼 + n/50 +
//     진행 바. (?) 는 `onPressHelp` 콜백으로 부모(홈 화면)가 `Alert.alert`
//     로 안내 카피를 표시한다 — 디자인 시스템 모달이 도착하면 부모에서만
//     교체하면 되도록 컴포넌트가 Alert 구현체를 직접 들고 있지 않는다.
//   - `count >= threshold`: "책 만들기" Primary CTA 로 전환 (자서전 탭으로
//     라우팅). 마찬가지로 hairline 구분만 갖고 카드 chrome 없이 표시된다.
//
// 표시되는 카운트는 `Math.min(count, threshold)` 로 클램프해 51/50 같은
// 어색한 숫자가 노출되지 않도록 한다 (임계값 도달 후엔 CTA 만 보이므로 사실상
// 표시되지 않지만, 진행 바 폭 계산에서도 동일하게 안전하다).

import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

import { Button } from './Button';
import { Text } from './Text';

export type BookProgressProps = {
  /** 활성 아이의 누적 답변 수. 음수는 0 으로 클램프된다. */
  count: number;
  /**
   * 책 완성 임계값. PRD-007 명시값 50. 후속 PR 에서 조정 가능하도록 prop
   * 으로 노출한다.
   */
  threshold?: number;
  /** (?) 도움말 탭 — 부모가 Alert/모달 등으로 안내 카피를 띄운다. */
  onPressHelp: () => void;
  /** "책 만들기" Primary CTA 탭 — 자서전 탭으로 라우팅. */
  onPressCta: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_THRESHOLD = 50;

export function BookProgress({
  count,
  threshold = DEFAULT_THRESHOLD,
  onPressHelp,
  onPressCta,
  style,
  testID = 'book-progress',
}: BookProgressProps) {
  const safeCount = count < 0 ? 0 : count;
  const reached = safeCount >= threshold;
  const displayCount = safeCount > threshold ? threshold : safeCount;
  const progressPct = threshold > 0 ? (displayCount / threshold) * 100 : 0;

  return (
    <View style={[styles.section, style]} testID={testID}>
      {reached ? (
        <View testID="book-progress-cta-wrap">
          <Button
            title="책 만들기"
            leading="📖"
            variant="primary"
            fullWidth
            onPress={onPressCta}
            testID="book-progress-cta"
          />
        </View>
      ) : (
        <View testID="book-progress-progress-wrap">
          <View style={styles.row}>
            <View style={styles.copyRow}>
              <Text
                variant="caption"
                color="secondary"
                style={styles.copy}
                numberOfLines={1}
                testID="book-progress-copy"
              >
                아이에게 전해줄 책이 만들어지고 있어요
              </Text>
              <HelpButton onPress={onPressHelp} />
            </View>
            <Text
              variant="badge"
              color="coral"
              style={styles.fraction}
              testID="book-progress-fraction"
            >
              {`${displayCount}/${threshold}`}
            </Text>
          </View>
          <View style={styles.track} accessibilityRole="progressbar">
            <View
              style={[styles.fill, { width: `${progressPct}%` }]}
              testID="book-progress-fill"
            />
          </View>
        </View>
      )}
    </View>
  );
}

// (?) 도움말 버튼 — 16×16 원형, beige 배경. mockup 의 `w-4 h-4 rounded-full
// bg-beige` 와 1:1 매핑.
function HelpButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="책 진행도 안내"
      hitSlop={8}
      style={styles.help}
      testID="book-progress-help"
    >
      <Text variant="badge" color="secondary" style={styles.helpGlyph}>
        ?
      </Text>
    </Pressable>
  );
}

const HELP_SIZE = 16;
const TRACK_HEIGHT = 4;

const styles = StyleSheet.create({
  // mockup: `mt-3.5 pt-3 border-t border-beige/60`. marginTop 은 카드 내부의
  // 다른 행과의 간격(spacing[3] ≈ 12px), paddingTop 도 spacing[3].
  section: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bg.beige,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    flexShrink: 1,
  },
  copy: { flexShrink: 1 },
  fraction: { fontVariant: ['tabular-nums'] },
  help: {
    width: HELP_SIZE,
    height: HELP_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.bg.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpGlyph: { fontSize: 10, lineHeight: 12 },
  track: {
    marginTop: spacing[2],
    height: TRACK_HEIGHT,
    backgroundColor: colors.bg.beige,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary.coral,
    borderRadius: radius.full,
  },
});
