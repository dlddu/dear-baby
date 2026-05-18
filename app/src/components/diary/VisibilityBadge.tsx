// VisibilityBadge — `🔒 비공개` / `🌐 공개` 마이크로 라벨. 일기 카드와 상세
// 메타 영역에서 동일한 톤으로 노출한다 (M-36/M-38).

import { StyleSheet } from 'react-native';

import { colors } from '../../theme/colors';
import type { RecordVisibility } from '../../api/types';
import { Text } from '../Text';

export type VisibilityBadgeProps = {
  visibility: RecordVisibility;
  testID?: string;
};

export function VisibilityBadge({ visibility, testID }: VisibilityBadgeProps) {
  const isPublic = visibility === 'public';
  // Suffix the testID with the visibility state so e2e flows can assert
  // which state the badge is in without text matching (Android Maestro 가
  // 이모지 + Korean 혼합 텍스트의 부분 매칭에서 자주 실패).
  const stateTestID = testID ? `${testID}-${visibility}` : undefined;
  return (
    <Text
      variant="micro"
      style={[styles.label, { color: isPublic ? colors.accent.sage : colors.text.muted }]}
      testID={stateTestID}
    >
      {isPublic ? '🌐 공개' : '🔒 비공개'}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '500',
  },
});
