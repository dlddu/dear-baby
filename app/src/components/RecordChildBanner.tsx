// RecordChildBanner — 기록 작성 화면 상단에 "지금 [아이 이름]에게 기록하고
// 있어요" 한 줄을 노출한다. 다자녀·단일 사용자 모두에게 동일하게 보여서
// PRD-008 AC-008-01 (아이 컨텍스트 칩을 단일·다자녀 가리지 않고 일관 노출)
// 의 일관성 원칙을 따른다.
//
// 디자인 토큰만 사용 — 새 색상/사이즈 도입 없이 caption + muted + spacing
// 조합으로 최소 침습 구현. 후속 디자인 리뷰에서 위치·문구가 바뀔 수 있으므로
// 별도 컴포넌트로 분리해 두었다.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../theme/spacing';

import { Text } from './Text';

export type RecordChildBannerProps = {
  /** 표시할 아이 이름 (태명/이름). 비어 있으면 컴포넌트가 null 을 렌더. */
  displayName: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function RecordChildBanner({
  displayName,
  style,
  testID,
}: RecordChildBannerProps) {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) return null;
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <Text variant="caption" color="muted">
        지금 <Text variant="caption" color="primary">{trimmed}</Text>에게 기록하고 있어요
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing[1] },
});
