// ProgressBar — 와이어프레임의 상단 트랙 + 채움 + "n / N" 텍스트
// (or "Case X · n / N"). 케이스가 결정되면 케이스 액센트로 채워지고,
// 케이스 결정 전(Q1·Q2)에는 그레이로 채운다.

import { StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccent';

export type ProgressBarProps = {
  /** Current step number, 1-based. */
  current: number;
  /** Total number of steps. */
  total: number;
  /** Optional Case label prefix (e.g., "Case A"). When provided the
   *  text reads "Case A · n / N"; otherwise it shows "n / N". */
  label?: string;
};

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const accent = useCaseAccent();
  const ratio = Math.max(0, Math.min(1, current / Math.max(1, total)));
  const text = label ? `${label} · ${current}/${total}` : `${current} / ${total}`;
  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: colors.bg.beige }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${ratio * 100}%`,
              backgroundColor: accent.base,
            },
          ]}
        />
      </View>
      <Text variant="caption" color="secondary" style={[styles.label, { color: accent.ink }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  track: {
    height: 4,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.xs,
  },
  label: {
    fontWeight: '500',
  },
});
