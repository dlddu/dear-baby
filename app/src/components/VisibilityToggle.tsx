// VisibilityToggle — 기록 저장(확정) 화면의 공개/비공개 선택 (PRD-001
// AC-001-06). 기본값은 비공개이고, 공개를 고르면 그 기록이 커뮤니티 노출
// 대상이 된다 (의미는 PRD-009). 저장 후 변경은 일기 탭의 사후 토글
// (AC-008-07) 소관이다.
//
// 선택 상태는 **컨테이너 testID 의 접미사**(`-private` / `-public`)로
// 노출한다 — VisibilityBadge 와 같은 규약이다. 칩 자체의 testID 는
// `-option-*` 로 고정해 탭 대상으로만 쓴다. 이렇게 나눠야 e2e 가
// "무엇이 선택돼 있는가" 를 한국어·이모지 부분 매칭 없이 단정할 수 있다
// (Android Maestro 는 혼합 텍스트 부분 매칭에서 자주 실패한다).

import { Pressable, StyleSheet, View } from 'react-native';

import type { RecordVisibility } from '../api/types';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { Text } from './Text';

export type VisibilityToggleProps = {
  value: RecordVisibility;
  onChange: (next: RecordVisibility) => void;
  disabled?: boolean;
  testID?: string;
};

const OPTIONS: { value: RecordVisibility; label: string }[] = [
  { value: 'private', label: '🔒 비공개' },
  { value: 'public', label: '🌐 공개' },
];

export function VisibilityToggle({
  value,
  onChange,
  disabled = false,
  testID,
}: VisibilityToggleProps) {
  return (
    <View style={styles.wrap} testID={testID ? `${testID}-${value}` : undefined}>
      <Text variant="micro" color="secondary">
        공개 여부
      </Text>
      <View style={styles.row}>
        {OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              disabled={disabled}
              onPress={() => onChange(opt.value)}
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
              testID={testID ? `${testID}-option-${opt.value}` : undefined}
            >
              <Text
                variant="micro"
                color={active ? 'onPrimary' : 'primary'}
                style={styles.chipText}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  chipActive: { backgroundColor: colors.primary.coral },
  chipInactive: {
    backgroundColor: colors.bg.cream,
    borderWidth: 1,
    borderColor: colors.bg.beige,
  },
  chipText: { fontWeight: '500' },
});
