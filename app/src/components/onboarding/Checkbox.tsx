// Checkbox — A3/B6/C3 의 다중 선택 옵션에 들어가는 작은 체크박스.
// SelectCard 의 leading 으로 결합해 사용.

import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';

import { useCaseAccent } from './CaseAccent';

export type CheckboxProps = {
  checked: boolean;
};

export function Checkbox({ checked }: CheckboxProps) {
  const accent = useCaseAccent();
  return (
    <View
      style={[
        styles.box,
        checked
          ? { backgroundColor: accent.base, borderColor: accent.base }
          : { backgroundColor: 'transparent', borderColor: colors.bg.beige },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  box: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderRadius: radius.xs / 2,
  },
});
