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
  /**
   * 카드 사이 섹션 헤더 — 14/700. 홈 “다른 엄마들의 기록” 처럼 카드 그룹 위에 얹는 작은 헤더.
   * 커뮤니티 피드 카드의 마스킹 표시명(M-43 FeedCard 의 `text-[14px] font-bold`)도 같은 값이라
   * 슬롯을 나누지 않고 이 하나를 공유한다.
   */
  sectionTitle: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  /**
   * 세그먼티드 컨트롤의 항목 라벨 — 14/600.
   * 시각 출처: docs/mockups/source/src/screens/Community.tsx (M-43) 콘텐츠 타입 필터의
   * `text-[14px] font-semibold`. badge(12/600)보다 크고 sectionTitle(14/700)보다 가볍다.
   */
  segmentLabel: {
    fontFamily: fontFamilies.sansSemibold,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  /** 카드 타이틀 — 17/600 */
  h3: {
    fontFamily: fontFamilies.sansSemibold,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  /**
   * 탭 헤더·화면 섹션 타이틀 — 17/700.
   * 시각 출처: docs/mockups/source/src/screens/Community.tsx (M-43) 의
   * `text-[17px] font-bold` — 헤더 "커뮤니티" 와 "나와 비슷한 엄마들의 기록".
   * h3(17/600) 보다 한 단계 굵다: 목업의 탭 헤더는 M-36 부터 줄곧 font-bold 다.
   */
  h3Bold: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  /**
   * 커뮤니티 피드 카드의 제목·질문 — 15/700, lh 1.45.
   * 시각 출처: docs/mockups/source/src/screens/Community.tsx (M-43) FeedCard 의
   * `text-[15px] font-bold leading-[1.45]`. 홈 피드 카드(M-17)보다 한 단계 큰
   * 위계라 cardTitle(13/700)을 재사용하지 않는다.
   */
  feedTitle: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  /**
   * 커뮤니티 피드 카드의 본문 미리보기 — 13/400, lh 1.7.
   * 시각 출처: 같은 FeedCard 의 `text-[13px] leading-[1.7]`. caption(13/18, lh 1.4)
   * 과 크기는 같고 행간만 넓다 — 2~3줄 미리보기라 숨 쉴 공간이 필요하다.
   */
  feedBody: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 22,
  },
  /** 카드 내부 강조 타이틀 — 13/700. 피드 카드의 질문처럼 좁은 카드 안에서 시선을 잡는 굵은 본문. */
  cardTitle: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  /** 본문 — 15/400, lh 1.6 */
  body: {
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
  },
  /** 보조 본문 — 12/400, lh 1.55. 답변 스니펫·“더보기” 처럼 본문보다 한 단계 작은 위계. */
  bodySmall: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
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
  /** 비식별 ID·강조 라벨 — 12/700. badge 보다 한 단계 굵게, alias(cho***3) 같이 카드의 정체성을 잡는 라벨용. */
  aliasStrong: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  /** 부차 캡션 — 11/400, lh 1.4. 작성자 컨텍스트·♥ 카운트처럼 카드의 가장자리에 들어가는 메타 정보. */
  micro: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    fontWeight: '400',
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
  /** 도입부 히어로 이모지 — 48/64. 온보딩 b0·b3 의 큰 이모지 한 글자용. */
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
