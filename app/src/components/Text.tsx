// Themed Text component.
// RN Text 를 감싸 디자인 시스템의 Typography 변형을 적용한다.
//
// 사용 예:
//   <Text variant="h1">DearBaby</Text>
//   <Text variant="caption" color="muted">3월 22일</Text>

import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { colors } from '../theme/colors';
import { typography, type TypographyVariant } from '../theme/typography';

type TextColor = 'primary' | 'secondary' | 'muted' | 'onPrimary' | 'coral';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
};

const colorMap: Record<TextColor, string> = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  muted: colors.text.muted,
  onPrimary: colors.text.onPrimary,
  coral: colors.primary.coral,
};

export function Text({
  variant = 'body',
  color = 'primary',
  style,
  ...rest
}: AppTextProps) {
  const base = typography[variant] as TextStyle;
  return (
    <RNText style={[base, { color: colorMap[color] }, style]} {...rest} />
  );
}
