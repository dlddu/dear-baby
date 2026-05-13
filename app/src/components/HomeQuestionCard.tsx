// HomeQuestionCard — PRD-007 AC-007-04·05·06 의 홈 1인칭 질문 카드.
//
// 시각 출처: docs/mockups/source/src/screens/HomePregnancyScreen.tsx L42-95.
// 카드 구성:
//   - 좌측 컬럼: 60×60 원형 프로필 + 이름 + 컨텍스트 라벨 (D-36 등)
//   - 우측 말풍선: 1인칭 질문 텍스트 + 회전 footer (◀ n/3 ▶)
//   - 카드 하단 grid-cols-2: 음성/텍스트 CTA
//   - 옵션 `footer` 슬롯: CTA 아래의 추가 영역 (책 진행도 등). mockup 의
//     `mt-3.5 pt-3 border-t` hairline 구분 영역과 시각적으로 매칭되도록
//     슬롯 자체엔 별도 chrome 을 주지 않고, footer 컴포넌트가 자기 marginTop·
//     borderTop 을 들고 있는 것을 가정한다 (BookProgress 가 그 규약을 따른다).
//
// 회전 상태(현재 인덱스) 는 부모가 관리한다 — 본 컴포넌트는 표시·이벤트만
// 책임지고 stateless 하게 유지해 단위 테스트를 단순화한다. 1/3 에서 좌 화살표,
// 3/3 에서 우 화살표가 비활성 상태로 노출되며, 비활성 상태에서는 onPrev /
// onNext 가 호출되지 않는다.

import type { ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';

import { Button } from './Button';
import { Text } from './Text';

export type HomeQuestionCardProps = {
  /** 프로필 이미지 URL. null/undefined 면 이모지 fallback 을 표시한다. */
  profileImageUrl?: string | null;
  /** 이미지가 없을 때 보여줄 이모지 (예: '🌱'). */
  profileGlyph?: string;
  /** 활성 아이 표시 이름 (태명/이름). */
  displayName: string;
  /** AC-007-01 컨텍스트 라벨 (D-36 / 28주차 / 5개월 / 2살). null 이면 미표시. */
  contextLabel: string | null;
  /** 회전 풀 (최대 3개). 비어 있으면 카드를 렌더하지 않는다. */
  questions: readonly string[];
  /** 현재 표시 중인 인덱스 (0-based). 범위를 벗어나면 0 으로 클램프된다. */
  currentIndex: number;
  /** 좌 화살표 탭. 1/3 일 때는 호출되지 않는다 (UI 비활성). */
  onPrev: () => void;
  /** 우 화살표 탭. 마지막 인덱스에서는 호출되지 않는다 (UI 비활성). */
  onNext: () => void;
  /** 음성 CTA — '목소리로 남기기' */
  onPressVoice: () => void;
  /** 텍스트 CTA — '글로 남기기' */
  onPressText: () => void;
  /**
   * CTA 아래 hairline 구분 영역에 넣을 추가 콘텐츠 (예: BookProgress).
   * 카드와 시각적으로 한 덩어리가 되도록, 슬롯 컨텐츠가 자기 marginTop·
   * borderTop 을 들고 있는 것을 가정한다.
   */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const PROFILE_SIZE = 60;
const BUBBLE_TAIL_SIZE = 12;
const ARROW_HIT_SIZE = 28;

export function HomeQuestionCard({
  profileImageUrl,
  profileGlyph = '🌱',
  displayName,
  contextLabel,
  questions,
  currentIndex,
  onPrev,
  onNext,
  onPressVoice,
  onPressText,
  footer,
  style,
  testID = 'home-question-card',
}: HomeQuestionCardProps) {
  if (questions.length === 0) return null;
  const clampedIndex =
    currentIndex < 0
      ? 0
      : currentIndex >= questions.length
        ? questions.length - 1
        : currentIndex;
  const question = questions[clampedIndex];
  const canPrev = clampedIndex > 0;
  const canNext = clampedIndex < questions.length - 1;
  const indexLabel = `${clampedIndex + 1}/${questions.length}`;

  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={styles.row}>
        <View style={styles.profileColumn}>
          {profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              style={styles.profile}
              accessibilityLabel={`${displayName} 프로필 이미지`}
            />
          ) : (
            <View
              style={[styles.profile, styles.profileFallback]}
              accessibilityLabel={`${displayName} 프로필 이미지`}
              testID="home-question-card-profile-fallback"
            >
              <Text style={styles.profileGlyph}>{profileGlyph}</Text>
            </View>
          )}
          <Text
            variant="badge"
            color="primary"
            style={styles.profileName}
            numberOfLines={1}
            testID="home-question-card-name"
          >
            {displayName}
          </Text>
          {contextLabel ? (
            <Text
              variant="badge"
              color="coral"
              style={styles.profileContext}
              testID="home-question-card-context"
            >
              {contextLabel}
            </Text>
          ) : null}
        </View>

        <View style={styles.bubbleColumn}>
          <View style={styles.bubbleTail} />
          <View style={styles.bubble}>
            <Text
              variant="emotion"
              color="primary"
              style={styles.bubbleText}
              testID="home-question-card-question"
            >
              {question}
            </Text>
            <View style={styles.rotationRow}>
              <Pressable
                onPress={canPrev ? onPrev : undefined}
                disabled={!canPrev}
                accessibilityRole="button"
                accessibilityLabel="이전 질문"
                accessibilityState={{ disabled: !canPrev }}
                hitSlop={6}
                style={[styles.arrow, !canPrev && styles.arrowDisabled]}
                testID="home-question-card-prev"
              >
                <Text variant="caption" color={canPrev ? 'secondary' : 'muted'}>
                  ◀
                </Text>
              </Pressable>
              <Text
                variant="caption"
                color="secondary"
                style={styles.indexLabel}
                testID="home-question-card-index"
              >
                {indexLabel}
              </Text>
              <Pressable
                onPress={canNext ? onNext : undefined}
                disabled={!canNext}
                accessibilityRole="button"
                accessibilityLabel="다음 질문"
                accessibilityState={{ disabled: !canNext }}
                hitSlop={6}
                style={[styles.arrow, !canNext && styles.arrowDisabled]}
                testID="home-question-card-next"
              >
                <Text variant="caption" color={canNext ? 'secondary' : 'muted'}>
                  ▶
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.ctaRow}>
        <View style={styles.ctaItem}>
          <Button
            title="목소리로 남기기"
            leading="🎙️"
            variant="primary"
            fullWidth
            onPress={onPressVoice}
            testID="home-voice-cta"
          />
        </View>
        <View style={styles.ctaItem}>
          <Button
            title="글로 남기기"
            leading="✏️"
            variant="secondary"
            fullWidth
            onPress={onPressText}
            testID="home-text-cta"
          />
        </View>
      </View>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.md,
    padding: spacing[4],
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  profileColumn: {
    width: 68,
    alignItems: 'center',
  },
  profile: {
    width: PROFILE_SIZE,
    height: PROFILE_SIZE,
    borderRadius: radius.full,
    ...shadows.soft,
  },
  profileFallback: {
    backgroundColor: colors.icon.question,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileGlyph: { fontSize: 28, lineHeight: 32 },
  profileName: {
    marginTop: spacing[1],
    textAlign: 'center',
  },
  profileContext: {
    marginTop: 2,
    textAlign: 'center',
  },
  bubbleColumn: {
    flex: 1,
    position: 'relative',
  },
  bubbleTail: {
    position: 'absolute',
    left: -BUBBLE_TAIL_SIZE / 2,
    top: spacing[4],
    width: BUBBLE_TAIL_SIZE,
    height: BUBBLE_TAIL_SIZE,
    backgroundColor: colors.bg.cream,
    transform: [{ rotate: '45deg' }],
  },
  bubble: {
    backgroundColor: colors.bg.cream,
    borderRadius: radius.md,
    padding: spacing[3],
  },
  bubbleText: {
    marginBottom: spacing[2],
  },
  rotationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bg.beige,
    paddingTop: spacing[2],
  },
  arrow: {
    width: ARROW_HIT_SIZE,
    height: ARROW_HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.35 },
  indexLabel: {
    minWidth: 28,
    textAlign: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  ctaItem: { flex: 1 },
});
