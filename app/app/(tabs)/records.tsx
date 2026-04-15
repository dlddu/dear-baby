// Records list — PRD-001 AC-001-05. Groups records by week (pregnancy week
// when the due date is known; otherwise ISO calendar week), newest-first.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Badge } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import {
  groupRecordsByWeek,
  type RecordGroup,
} from '../../src/records/pregnancyWeek';
import type { Record } from '../../src/records/types';
import { useRecords } from '../../src/records/useRecords';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function RecordsTab() {
  const { records, loading, refresh } = useRecords();
  const router = useRouter();

  // Refresh when the user navigates back to this tab so newly-saved
  // records appear without requiring pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const groups = groupRecordsByWeek(records);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="records-tab"
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} />
      }
    >
      <Text variant="h2" color="primary">
        기록
      </Text>
      {records.length === 0 ? (
        <Card surface="cream" style={styles.empty} testID="records-empty">
          <Text variant="h3" color="primary">
            아직 기록이 없어요
          </Text>
          <Text variant="caption" color="muted">
            홈에서 첫 번째 기록을 시작해보세요 🌱
          </Text>
        </Card>
      ) : (
        groups.map((group) => (
          <RecordGroupSection
            key={group.key}
            group={group}
            onSelect={(id) => router.push(`/record/${id}`)}
          />
        ))
      )}
    </ScrollView>
  );
}

function RecordGroupSection({
  group,
  onSelect,
}: {
  group: RecordGroup;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text variant="h3" color="secondary" style={styles.groupHeader}>
        {group.label}
      </Text>
      {group.records.map((record) => (
        <RecordRow
          key={record.id}
          record={record}
          onPress={() => onSelect(record.id)}
        />
      ))}
    </View>
  );
}

function RecordRow({
  record,
  onPress,
}: {
  record: Record;
  onPress: () => void;
}) {
  const preview = record.text.length > 80
    ? `${record.text.slice(0, 80).trim()}…`
    : record.text;
  const dateLabel = formatDate(record.createdAt);
  return (
    <Pressable
      onPress={onPress}
      testID={`record-row-${record.id}`}
      style={({ pressed }) => [
        styles.rowPressable,
        pressed && styles.rowPressed,
      ]}
    >
      <Card style={styles.row}>
        <View style={styles.rowTop}>
          <Badge
            label={record.type === 'voice' ? '음성' : '텍스트'}
            variant={record.type === 'voice' ? 'category' : 'secondary'}
          />
          <Text variant="caption" color="muted">
            {dateLabel}
          </Text>
        </View>
        <Text variant="body" color="primary" numberOfLines={3}>
          {preview}
        </Text>
      </Card>
    </Pressable>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}월 ${day}일`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.cream,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  empty: {
    gap: spacing[2],
    marginTop: spacing[3],
  },
  group: {
    gap: spacing[2],
  },
  groupHeader: {
    marginTop: spacing[2],
  },
  rowPressable: {
    borderRadius: 16,
  },
  rowPressed: { opacity: 0.85 },
  row: {
    gap: spacing[2],
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
