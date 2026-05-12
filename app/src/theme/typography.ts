// Typography scale — see docs/design-system/typography.md
// RN 의 TextStyle 와 직접 호환되도록 구성.

import type { TextStyle } from 'react-native';

import { fontFamilies } from './fonts';

type TypographyStyle = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight'
>;

// 줄 간격(line-height)은 본문 1.6, 캡션 1.4 기본 (문서 가이드).
// RN 의 lineHeight 는 px 단위이므로 fontSize * 배수로 사전 계산.

export const typography = {
  /** 영문 로고 (Serif, 28px/700) — Greeting/브랜드 전용 */
  display: {
    fontFamily: fontFamilies.serif,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  /** 앱 타이틀 — 28/700 */
  h1: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  /** 섹션 타이틀 — 20/700 */
  h2: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  /** 감성 타이틀 — 22/700 Serif. 온보딩 질문 헤더처럼 섹션 타이틀에 정서적 무게를 줄 때. */
  h2Serif: {
    fontFamily: fontFamilies.serif,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 32,
  },
  /** 카드 타이틀 — 17/600 */
  h3: {
    fontFamily: fontFamilies.sansSemibold,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  /** 본문 — 15/400, lh 1.6 */
  body: {
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
  },
  /** 캡션 — 13/400, lh 1.4 */
  caption: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  /** 배지 — 12/600 */
  badge: {
    fontFamily: fontFamilies.sansSemibold,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  /** 감성 카피 (캐치프레이즈) — 15/400 Serif */
  emotion: {
    fontFamily: fontFamilies.emotion,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
  },
  /** 인라인 도움말 이모지 — 16/20. Sans 본문과 함께 한 줄에 들어가는 단일 이모지 한 글자용. */
  emoji: {
    fontFamily: fontFamilies.sans,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
  },
  /** 도입부 히어로 이모지 — 48/64. 온보딩 b0·b3·not-ready 의 큰 이모지 한 글자용. */
  iconHero: {
    fontFamily: fontFamilies.emotion,
    fontSize: 48,
    fontWeight: '400',
    lineHeight: 64,
  },
  /** 부드러운 안내문 — 15/22. body 보다 살짝 좁은 행간으로 멀티라인 태그라인용. */
  tagline: {
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
} satisfies Record<string, TypographyStyle>;

export type TypographyVariant = keyof typeof typography;
