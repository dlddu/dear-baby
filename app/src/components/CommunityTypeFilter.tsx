// CommunityTypeFilter — PRD-009 AC-009-06 콘텐츠 타입 필터.
//
// 시각 출처: docs/mockups/source/src/screens/Community.tsx (M-43) L131-146.
//   컨테이너: `bg-cream border border-beige rounded-db-md p-1`
//   세그먼트: `flex-1 text-center py-2.5 rounded-db-sm text-[14px] font-semibold`
//   활성:     `bg-coral text-white shadow-db-sm` / 비활성: `text-ink-sub`
//
// **`Pill` 을 재사용하지 않는 이유**: M-43 의 필터는 개별 알약 3개를 나열한
// 것이 아니라 테두리를 두른 세그먼티드 컨트롤 한 덩어리다. Pill 을 늘려
// 흉내 내면 그 컴포넌트의 원래 소비처(온보딩 성별 선택, M-08)의 시각이 함께
// 흔들린다.
//
// 항목의 라벨·순서·기본값은 AC-009-06 표 그대로이며, 어떤 기록이 어느 타입인지
// 거르는 주체는 서버다 (`type` 쿼리 파라미터).

import { Pressable, StyleSheet, View } from 'react-native';

import type { CommunityFeedType } from '../api/community';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';

import { Text } from './Text';

// AC-009-06 표의 항목과 순서 그대로 — 전체 → 질문답변 → 자유일기.
export const COMMUNITY_TYPE_FILTERS: readonly {
  value: CommunityFeedType;
  label: string;
}[] = [
  { value: 'all', label: '전체' },
  { value: 'question', label: '질문답변' },
  { value: 'diary', label: '자유일기' },
] as const;

export type CommunityTypeFilterProps = {
  value: CommunityFeedType;
  onChange: (next: CommunityFeedType) => void;
  testID?: string;
};

export function CommunityTypeFilter({
  value,
  onChange,
  testID = 'community-type-filter',
}: CommunityTypeFilterProps) {
  return (
    <View style={styles.container} testID={testID}>
      {COMMUNITY_TYPE_FILTERS.map((f) => {
        const selected = f.value === value;
        return (
          <Pressable
            key={f.value}
            onPress={() => onChange(f.value)}
            accessibilityRole="button"
            accessibilityLabel={f.label}
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
            testID={`community-filter-${f.value}`}
          >
            <Text
              variant="segmentLabel"
              color={selected ? 'onPrimary' : 'secondary'}
            >
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bg.cream,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    borderRadius: radius.md,
    padding: spacing[1],
  },
  segment: {
    flex: 1,
    // M-43 의 `py-2.5` = 10px. 4의 배수가 아니라 spacing 토큰에 없다.
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.primary.coral,
    ...shadows.card,
  },
});
