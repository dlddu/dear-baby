// CaseHeader is the top-of-screen block shared by every case screen:
// progress bar, "Case X · n/N" badge text, optional repeat-badge on
// the right.
//
// Wireframe references: docs/wireframes/onboarding/case-{a,b,c}.svg.

import { StyleSheet, View } from 'react-native';

import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

import { useCaseAccent } from './CaseAccentTheme';
import { ProgressBar } from './ProgressBar';
import { RepeatBadge } from './RepeatBadge';

export type CaseHeaderProps = {
  step: number;
  totalSteps: number;
  /** Override the textual label. Defaults to "Case A · n/N". */
  label?: string;
  /** Optional "반복 n/N" badge for repeating-input screens. */
  repeat?: { current: number; total: number };
};

export function CaseHeader({ step, totalSteps, label, repeat }: CaseHeaderProps) {
  const accent = useCaseAccent();
  return (
    <View style={styles.wrapper}>
      <ProgressBar current={step} total={totalSteps} />
      <View style={styles.row}>
        <Text variant="badge" style={{ color: accent.text }}>
          {label ?? `${step}/${totalSteps}`}
        </Text>
        {repeat ? <RepeatBadge current={repeat.current} total={repeat.total} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing[5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
