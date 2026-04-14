// Custom font loading — see docs/design-system/typography.md
//
// - 영문 로고 / 감성 디스플레이: Playfair Display (Serif)
// - 한글 UI: Noto Sans KR — 문서의 Pretendard는 npm 미배포이므로 문서상 대체 후보인
//   Noto Sans KR 을 사용한다.
// - 감성 캐치프레이즈: Gowun Batang (마루 부리의 Google Fonts 대체 세리프)
//
// 폰트 패밀리 문자열은 `@expo-google-fonts/*` 의 export 이름과 동일.

import { useFonts } from 'expo-font';
import {
  GowunBatang_400Regular,
  GowunBatang_700Bold,
} from '@expo-google-fonts/gowun-batang';
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_600SemiBold,
  NotoSansKR_700Bold,
} from '@expo-google-fonts/noto-sans-kr';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';

export const fontFamilies = {
  /** 영문 로고 / 감성 디스플레이 (Serif) */
  serif: 'PlayfairDisplay_700Bold',
  serifRegular: 'PlayfairDisplay_400Regular',
  /** 한글 UI 기본 (Sans) */
  sans: 'NotoSansKR_400Regular',
  sansMedium: 'NotoSansKR_500Medium',
  sansSemibold: 'NotoSansKR_600SemiBold',
  sansBold: 'NotoSansKR_700Bold',
  /** 감성 캐치프레이즈 (세리프) */
  emotion: 'GowunBatang_400Regular',
  emotionBold: 'GowunBatang_700Bold',
} as const;

export type FontFamily = (typeof fontFamilies)[keyof typeof fontFamilies];

export function useAppFonts() {
  return useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_600SemiBold,
    NotoSansKR_700Bold,
    GowunBatang_400Regular,
    GowunBatang_700Bold,
  });
}
