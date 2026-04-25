// 녹음 보관함 — 텍스트는 서버에 이미 저장됐지만 음성 원본만 이 기기에
// 남아있는 항목들의 목록.
//
// 행 액션 2개:
//  - 업로드: uploadAudio(record_id) 실행. 성공 시 자동으로 목록에서
//    제거되며, 실패 시 'failed' 상태로 남는다.
//  - 삭제: 로컬 오디오만 제거. 서버 records row 와 텍스트는 그대로
//    유지되며 audio_s3_key 는 영원히 NULL 상태로 둔다.
//
// 디자인 시스템 준수: Card 컴포넌트(ivory) + Badge(상태) + Button
// 보조 액션. 빈 상태는 secondary text + emotion variant.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '../src/components/Badge';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Text } from '../src/components/Text';
import * as draftStore from '../src/drafts/draftStore';
import type { LocalAudio } from '../src/drafts/types';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { uploadAudio } from '../src/voice/uploadAudio';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function statusLabel(status: LocalAudio['upload_status']): {
  label: string;
  variant: 'week' | 'secondary' | 'category';
} {
  switch (status) {
    case 'uploading':
      return { label: '업로드 중', variant: 'category' };
    case 'failed':
      return { label: '실패', variant: 'secondary' };
    default:
      return { label: '이 기기에만 있음', variant: 'secondary' };
  }
}

export default function DraftsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LocalAudio[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await draftStore.list();
    setItems(next);
  }, []);

  // Refresh on focus so coming back from another flow (e.g. just
  // recorded a new audio without uploading) updates the list.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleUpload = useCallback(
    async (recordID: string) => {
      setBusy(recordID);
      try {
        const result = await uploadAudio(recordID);
        if (result.status === 'failed') {
          Alert.alert('업로드 실패', result.error);
        }
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    (recordID: string) => {
      Alert.alert(
        '음성 원본을 삭제할까요?',
        '이 음성 파일은 이 기기에서 삭제되며, 서버에는 저장되지 않습니다. 텍스트 기록은 유지됩니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              await draftStore.remove(recordID);
              await refresh();
            },
          },
        ],
      );
    },
    [refresh],
  );

  const renderItem = useCallback(
    ({ item }: { item: LocalAudio }) => {
      const status = statusLabel(item.upload_status);
      const isBusy = busy === item.record_id || item.upload_status === 'uploading';
      return (
        <Card style={styles.card} testID={`drafts-row-${item.record_id}`}>
          <View style={styles.headerRow}>
            <Text variant="caption" color="muted">
              {formatDate(item.created_at)} · {formatDuration(item.audio_duration_ms)}
            </Text>
            <Badge label={status.label} variant={status.variant} />
          </View>
          <Text variant="body" color="primary" numberOfLines={2} style={styles.preview}>
            {item.transcript_preview || '(미리보기 없음)'}
          </Text>
          {item.last_error ? (
            <Text variant="caption" color="muted" style={styles.error}>
              {item.last_error}
            </Text>
          ) : null}
          <View style={styles.rowActions}>
            <View style={styles.actionItem}>
              <Button
                title={isBusy ? '업로드 중…' : '업로드'}
                variant="primary"
                fullWidth
                disabled={isBusy}
                onPress={() => void handleUpload(item.record_id)}
                testID={`drafts-upload-${item.record_id}`}
              />
            </View>
            <View style={styles.actionItem}>
              <Button
                title="삭제"
                variant="secondary"
                fullWidth
                disabled={isBusy}
                onPress={() => handleDelete(item.record_id)}
                testID={`drafts-delete-${item.record_id}`}
              />
            </View>
          </View>
        </Card>
      );
    },
    [busy, handleUpload, handleDelete],
  );

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="drafts-screen"
    >
      <View style={styles.topbar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={8}
          testID="drafts-back"
        >
          <Text variant="body" color="secondary">
            뒤로
          </Text>
        </Pressable>
        <Text variant="h2" color="primary" style={styles.title}>
          녹음 보관함
        </Text>
        <View style={styles.spacer} />
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="emotion" color="secondary" style={styles.emptyText}>
            보관 중인 음성 원본이 없어요 🌷
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.record_id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  title: { flex: 1, textAlign: 'center' },
  spacer: { width: 32 },
  list: { padding: spacing[5], gap: spacing[4] },
  card: { gap: spacing[3] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {},
  error: {},
  rowActions: { flexDirection: 'row', gap: spacing[3] },
  actionItem: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  emptyText: { textAlign: 'center' },
});
