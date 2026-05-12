// OnboardingTopRow — onboarding 상단 ProgressDots(+ optional 인덱스 Badge)
// 공통 행 레이아웃. 16개 온보딩 화면에서 동일한 마크업을 한 곳으로 모은다.
//
// 사용 예시:
//   // 단일 인스턴스 화면 (q1, q2, a1, a3, b0, b1, b3, b4, b6, c1)
//   <OnboardingTopRow current={2} total={5} />
//
//   // 다인스턴스 화면 (a2 / b2 / b2-purpose / b5 / c2 / c3)
//   <OnboardingTopRow
//     current={3}
//     total={5}
//     index={fetusIndex}
//     count={total}
//     testIDPrefix="onboarding-a2-fetus-index"
//   />
//
// `count > 1 && index !== undefined` 일 때만 우측 상단 Badge 가 노출된다.
// Badge 의 marginRight / marginTop 은 ProgressDots 의 paddingHorizontal /
// paddingTop 과 시각적으로 짝을 이루도록 동일한 spacing 토큰을 쓴다 — 한쪽
// 토큰을 바꾸면 같은 파일 안에서 함께 보인다.

import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme/spacing';

import { Badge } from './Badge';
import { ProgressDots } from './ProgressDots';

export type OnboardingTopRowProps = {
  /** ProgressDots 의 current (0-indexed). */
  current: number;
  /** ProgressDots 의 total (단계 수). */
  total: number;
  /** 다인스턴스 화면일 때 현재 인스턴스 인덱스 (0-indexed). */
  index?: number;
  /** 다인스턴스 화면일 때 전체 인스턴스 수. count > 1 일 때만 Badge 노출. */
  count?: number;
  /** Badge testID 의 접두사 (예: 'onboarding-a2-fetus-index'). */
  testIDPrefix?: string;
};

export function OnboardingTopRow({
  current,
  total,
  index,
  count,
  testIDPrefix,
}: OnboardingTopRowProps) {
  const showBadge = count !== undefined && count > 1 && index !== undefined;
  return (
    <View style={styles.row}>
      <ProgressDots total={total} current={current} style={styles.progress} />
      {showBadge && (
        <Badge
          label={`${index + 1}/${count}`}
          variant="category"
          testID={
            testIDPrefix !== undefined ? `${testIDPrefix}-${index}` : undefined
          }
          style={styles.badge}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progress: { flex: 1 },
  badge: {
    marginRight: spacing[6],
    marginTop: spacing[3],
  },
});
