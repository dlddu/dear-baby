// Inline label rendered above the step's headline, e.g. "Case A · 2/3"
// or for the common entry "1 / 3". Matches the small caption-weight
// text that appears just under the progress bar in the wireframes.

import { StyleSheet, View } from 'react-native';

import { caseAccent } from './caseTheme';
import type { CaseKind } from '../../api/onboarding';
import { Text } from '../Text';

export type CaseLabelProps = {
  caseKind?: CaseKind | null;
  step: number;
  total: number;
  /** Override the prefix; default is "Case X" for case kinds, or none. */
  prefix?: string;
};

export function CaseLabel({
  caseKind,
  step,
  total,
  prefix,
}: CaseLabelProps) {
  const accent = caseAccent(caseKind);
  const text = caseKind
    ? `${prefix ?? `Case ${caseKind}`} · ${step}/${total}`
    : `${step} / ${total}`;
  return (
    <View style={styles.row}>
      <Text variant="badge" style={{ color: accent.label }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingTop: 12,
  },
});
