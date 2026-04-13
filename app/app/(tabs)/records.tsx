import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';

import { listEntries } from '../../src/api/diary';
import { colors, radius } from '../../src/theme/colors';
import type { DiaryEntry } from '../../src/api/types';

const WEEKS = [17, 16, 15, 14, 13];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function RecordsTab() {
  const router = useRouter();
  const [selectedWeek, setSelectedWeek] = useState(WEEKS[0]);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      listEntries(selectedWeek)
        .then(setEntries)
        .catch(() => setEntries([]));
    }, [selectedWeek]),
  );

  return (
    <View style={styles.screen} testID="records-tab">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기록 목록</Text>
      </View>

      {/* Week Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekTabs}
      >
        {WEEKS.map((week) => (
          <Pressable
            key={week}
            style={[
              styles.weekTab,
              selectedWeek === week && styles.weekTabActive,
            ]}
            onPress={() => setSelectedWeek(week)}
          >
            <Text
              style={[
                styles.weekTabText,
                selectedWeek === week && styles.weekTabTextActive,
              ]}
            >
              {week}주
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Entry List */}
      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>이 주차의 기록이 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.listItem}
              onPress={() =>
                router.push({ pathname: '/edit', params: { id: item.id } })
              }
            >
              <View
                style={[
                  styles.listIcon,
                  item.entry_type === 'voice'
                    ? styles.listIconVoice
                    : styles.listIconText,
                ]}
              >
                <Text style={{ fontSize: 20 }}>
                  {item.entry_type === 'voice' ? '🎙️' : '✏️'}
                </Text>
              </View>
              <View style={styles.listBody}>
                <Text style={styles.listName} numberOfLines={1}>
                  {item.title || '무제'}
                </Text>
                <Text style={styles.listPreview} numberOfLines={2}>
                  {item.content}
                </Text>
              </View>
              <Text style={styles.listTime}>{formatDate(item.created_at)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgCream },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  weekTabs: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 8,
  },
  weekTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.bgWarm,
  },
  weekTabActive: {
    backgroundColor: colors.accentPeach,
  },
  weekTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  weekTabTextActive: {
    color: '#fff',
  },
  listItem: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'flex-start',
  },
  listIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listIconVoice: { backgroundColor: '#FCEEE4' },
  listIconText: { backgroundColor: '#E4EAF0' },
  listBody: { flex: 1, minWidth: 0 },
  listName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  listPreview: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  listTime: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.tabBorder,
    marginHorizontal: 24,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
