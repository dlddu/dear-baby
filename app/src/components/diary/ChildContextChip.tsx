// ChildContextChip — 일기 카드 / 상세 화면의 우상단에 노출되는 아이 컨텍스트
// 칩. M-36/M-38 의 `🌱 콩이 · 임신 28주차` 형태. 단일·다자녀 모두 동일하게
// 노출된다 (PRD-008 AC-008-03). 컨텍스트 라벨은 호출자가 이미 포맷한 문자열
// 을 그대로 넘긴다 — 본 컴포넌트는 시각만 책임진다.

import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

export type ChildContextChipProps = {
  emoji: string;
  name: string;
  contextLabel: string | null;
  testID?: string;
};

export function ChildContextChip({
  emoji,
  name,
  contextLabel,
  testID,
}: ChildContextChipProps) {
  return (
    <View style={styles.chip} testID={testID}>
      <Text variant="micro" color="primary">
        {emoji} {name}
        {contextLabel ? ` · ${contextLabel}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primary.peach + '4D', // 30% alpha
  },
});
