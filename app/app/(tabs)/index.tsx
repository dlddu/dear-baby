import { useCallback, useEffect, useState } from 'react';
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

import { useAuth } from '../../src/auth/AuthContext';
import { listEntries } from '../../src/api/diary';
import { colors, radius } from '../../src/theme/colors';
import type { DiaryEntry } from '../../src/api/types';

const CURRENT_WEEK = 17;

const THUMB_EMOJIS = ['🩺', '🌿', '💛', '🌸', '🎵', '☀️', '🌙'];
const THUMB_GRADIENTS: { from: string; to: string }[] = [
  { from: '#FCEEE4', to: '#F5D5C8' },
  { from: '#E8F0E4', to: '#D4E4D0' },
  { from: '#E4EAF0', to: '#D0DAE8' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function HomeTab() {
  const { user } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      listEntries(CURRENT_WEEK)
        .then(setEntries)
        .catch(() => {});
    }, []),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="home-tab">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>DearBaby</Text>
        <View style={styles.headerIcon}>
          <Text style={{ fontSize: 16 }}>🔔</Text>
        </View>
      </View>

      {/* Greeting Card */}
      <View style={styles.greetingCard}>
        <Text style={styles.greetingEmoji}>🌷</Text>
        <Text style={styles.greetingTitle}>오늘 하루는 어땠나요, 엄마?</Text>
        <Text style={styles.greetingSub}>아기에게 전하고 싶은 말을 들려주세요</Text>
        <View style={styles.recordButtons}>
          <Pressable
            style={styles.btnVoice}
            onPress={() => router.push('/recording')}
          >
            <Text style={{ fontSize: 14 }}>🎙️</Text>
            <Text style={styles.btnVoiceText}>음성으로 기록</Text>
          </Pressable>
          <Pressable
            style={styles.btnText}
            onPress={() => router.push('/text-input')}
          >
            <Text style={{ fontSize: 14 }}>✏️</Text>
            <Text style={styles.btnTextText}>텍스트로 작성</Text>
          </Pressable>
        </View>
      </View>

      {/* This Week's Records */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLeft}>
          <Text style={styles.sectionTitle}>이번 주 기록</Text>
          <View style={styles.weekBadge}>
            <Text style={styles.weekBadgeText}>임신 {CURRENT_WEEK}주</Text>
          </View>
        </View>
        <Pressable onPress={() => router.navigate('/(tabs)/records')}>
          <Text style={styles.sectionMore}>더보기 ›</Text>
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>아직 기록이 없어요</Text>
          <Text style={styles.emptyHint}>첫 번째 기록을 남겨보세요</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recordsScroll}
        >
          {entries.slice(0, 5).map((entry, i) => (
            <Pressable
              key={entry.id}
              style={styles.recordCard}
              onPress={() =>
                router.push({ pathname: '/edit', params: { id: entry.id } })
              }
            >
              <View
                style={[
                  styles.recordThumb,
                  {
                    backgroundColor:
                      THUMB_GRADIENTS[i % THUMB_GRADIENTS.length].from,
                  },
                ]}
              >
                <Text style={{ fontSize: 36 }}>
                  {THUMB_EMOJIS[i % THUMB_EMOJIS.length]}
                </Text>
              </View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordTitle} numberOfLines={1}>
                  {entry.title || '무제'}
                </Text>
                <Text style={styles.recordDate}>
                  {formatDate(entry.created_at)}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgCream },
  content: { paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 12,
  },
  logo: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    fontStyle: 'italic',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingCard: {
    marginHorizontal: 20,
    padding: 22,
    backgroundColor: '#FFF8F2',
    borderRadius: radius.lg,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  greetingEmoji: {
    position: 'absolute',
    top: 12,
    right: 16,
    fontSize: 22,
  },
  greetingTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 26,
    marginBottom: 4,
  },
  greetingSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  recordButtons: { flexDirection: 'row', gap: 10 },
  btnVoice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accentPeach,
  },
  btnVoiceText: { fontSize: 14, fontWeight: '500', color: '#fff' },
  btnText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  btnTextText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  weekBadge: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: colors.accentSoftPink,
    borderRadius: 20,
  },
  weekBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.accentRose,
  },
  sectionMore: { fontSize: 13, color: colors.textSecondary },
  recordsScroll: { paddingHorizontal: 24, gap: 12 },
  recordCard: {
    width: 140,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
    overflow: 'hidden',
  },
  recordThumb: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInfo: { padding: 10 },
  recordTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  recordDate: { fontSize: 11, color: colors.textLight },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptyHint: { fontSize: 13, color: colors.textLight },
});
