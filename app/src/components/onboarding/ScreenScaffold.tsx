// ScreenScaffold — shared chrome for every onboarding screen.
//
// Provides the cream background, vertical spacing, the case-aware
// progress bar at the top, and the case label badge ("Case A · 1/3"
// or "1 / 3" for the common entry). Body content is whatever the
// caller renders; the primary CTA is sticky-bottom via the actions
// slot so the layout matches the wireframe row.

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

import { Text } from '../Text';
import { ProgressBar } from './ProgressBar';
import { accentFor } from './caseAccent';
import type { OnboardingCase } from '../../api/types';

export type ScreenScaffoldProps = ViewProps & {
  case?: OnboardingCase | null;
  current: number;
  total: number;
  /** "Case A · 1/3" 또는 "1 / 3" 형태의 단계 라벨. 비우면 자동 생성. */
  stepLabel?: string;
  /** 우상단 슬롯(예: RepeatBadge). */
  topRight?: React.ReactNode;
  /** 본문 영역. */
  children: React.ReactNode;
  /** 화면 하단 고정 액션 영역(주로 다음/완료 버튼). */
  actions?: React.ReactNode;
  testID?: string;
};

export function ScreenScaffold({
  case: caseKind,
  current,
  total,
  stepLabel,
  topRight,
  children,
  actions,
  testID,
}: ScreenScaffoldProps) {
  const accent = accentFor(caseKind);
  const computedLabel =
    stepLabel ?? (caseKind ? `Case ${caseKind} · ${current}/${total}` : `${current} / ${total}`);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID={testID}>
      <KeyboardAvoidingView
        style={styles.flex}
        // Android 도 'height' 로 키보드 회피를 켜둬 sticky-bottom Next 버튼이
        // 키보드에 가려지지 않게 한다. iOS 는 'padding' 이 자연스러워 그대로.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <ProgressBar current={current} total={total} case={caseKind} />
          </View>
          {topRight ? <View style={styles.topRightSlot}>{topRight}</View> : null}
        </View>
        <Text
          variant="caption"
          style={{ color: accent.text, marginTop: spacing[2] }}
        >
          {computedLabel}
        </Text>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg.cream, paddingHorizontal: spacing[5] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingTop: spacing[3],
  },
  topRightSlot: {},
  scroll: {
    paddingTop: spacing[5],
    paddingBottom: spacing[6],
    gap: spacing[5],
  },
  actions: {
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
  },
});
