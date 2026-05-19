// 일기 탭 — PRD-008.
//
// 본 화면의 범위:
//   - 활성 아이 컨텍스트를 의도적으로 사용하지 않는다 (AC-008-01). 사용자의
//     모든 아이의 기록을 통합해서 월별 SectionList 로 렌더.
//   - 헤더는 일기 탭 전용 (AC-008-10): 좌우 화살표·아이 이름 없고 "일기"
//     타이틀 + 알림 + 필터 버튼만.
//   - 필터 시트는 화면-로컬 useState — 일기 탭 이탈 시 자연스럽게 초기화
//     (세션 단위 유지).
//   - 다자녀 시 필터 시트에 아이 칩 노출 (AC-008-08), 단일 아이는 칩 섹션
//     이 통째로 숨겨진다.
//   - 카드 탭 시 `/diary/[id]` 풀스크린 push. 상세에서 돌아오면
//     useFocusEffect 가 자연 재조회 — 삭제/편집/공개 토글 결과가 반영된다.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getUnreadCount } from '../../src/api/notifications';
import { listRecords } from '../../src/api/records';
import type { Record } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { DiaryCard } from '../../src/components/diary/DiaryCard';
import { DiaryEmpty } from '../../src/components/diary/DiaryEmpty';
import {
  DiaryFilterSheet,
  type DiaryFilterChild,
  type DiaryFilterValue,
} from '../../src/components/diary/DiaryFilterSheet';
import { DiaryHeader } from '../../src/components/diary/DiaryHeader';
import {
  describeSubject,
  formatCardDate,
  groupRecordsByMonth,
} from '../../src/components/diary/subjectLookup';
import { Text } from '../../src/components/Text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

const EMPTY_FILTER: DiaryFilterValue = { subjectIds: [], visibility: null };

export default function DiaryTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [records, setRecords] = useState<Record[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<DiaryFilterValue>(EMPTY_FILTER);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // 필터 시트가 다자녀일 때만 아이 칩을 노출하므로 사용자가 가진 모든 아이를
  // 한 곳에 합쳐 둔다 — children 먼저, fetuses 뒤 (홈 헤더와 같은 순서).
  const childOptions = useMemo<DiaryFilterChild[]>(() => {
    if (!user) return [];
    const out: DiaryFilterChild[] = [];
    for (const c of user.children ?? []) {
      out.push({
        subjectId: c.subject_id,
        emoji: '👶',
        name: c.name?.trim() || '우리 아이',
      });
    }
    for (const f of user.fetuses ?? []) {
      out.push({
        subjectId: f.subject_id,
        emoji: '🌱',
        name: f.nickname?.trim() || '우리 아이',
      });
    }
    return out;
  }, [user]);

  const hasActiveFilters =
    filter.subjectIds.length > 0 || filter.visibility !== null;

  // 일기 탭에 포커스가 올 때마다 목록 재조회. 다른 탭에서 기록을 작성하거나
  // 상세에서 편집/삭제 후 돌아오면 자연스럽게 최신 상태가 보인다.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void listRecords({
        subjectIds: filter.subjectIds,
        visibility: filter.visibility ?? undefined,
        limit: 100,
      })
        .then((res) => {
          if (!cancelled) setRecords(res.records);
        })
        .catch(() => {
          if (!cancelled) setRecords([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      void getUnreadCount().then((n) => {
        if (!cancelled) setUnreadCount(n);
      });
      return () => {
        cancelled = true;
      };
    }, [filter]),
  );

  const sections = useMemo(
    () => groupRecordsByMonth(records ?? []),
    [records],
  );

  const handleFilterApply = useCallback(
    (next: DiaryFilterValue) => {
      setFilter(next);
      setFilterSheetOpen(false);
    },
    [],
  );

  const handleCardPress = useCallback(
    (id: string) => {
      router.push({ pathname: '/diary/[id]', params: { id } });
    },
    [router],
  );

  const handleEmptyGoHome = useCallback(() => {
    router.push('/(tabs)');
  }, [router]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']} testID="diary-tab">
      <DiaryHeader
        hasUnreadNotification={unreadCount > 0}
        hasActiveFilters={hasActiveFilters}
        onPressFilters={() => setFilterSheetOpen(true)}
      />
      {loading && records === null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary.coral} />
        </View>
      ) : (records ?? []).length === 0 ? (
        <DiaryEmpty onGoHome={handleEmptyGoHome} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text variant="micro" color="coral" style={styles.sectionTitle}>
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const subj = describeSubject(user, item.subject_id, item.created_at);
            return (
              <DiaryCard
                dateLabel={formatCardDate(item.created_at)}
                childEmoji={subj.emoji}
                childName={subj.name}
                childContextLabel={subj.contextLabel}
                visibility={item.visibility}
                question={item.question_text}
                answerPreview={item.content}
                onPress={() => handleCardPress(item.id)}
                testID={`diary-list-card-${item.id}`}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        />
      )}

      <DiaryFilterSheet
        visible={filterSheetOpen}
        childOptions={childOptions}
        value={filter}
        onClose={() => setFilterSheetOpen(false)}
        onApply={handleFilterApply}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.cream,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
  },
  sectionHeader: {
    backgroundColor: colors.bg.cream,
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bg.beige,
    marginHorizontal: -spacing[5],
    paddingHorizontal: spacing[5],
  },
  sectionTitle: { fontWeight: '700', letterSpacing: 0.3 },
  itemSeparator: { height: spacing[2] },
  sectionSeparator: { height: spacing[2] },
});
