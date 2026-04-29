// 음성 원본 보관함 — records.row 는 이미 서버에 있고, audio 만 로컬에
// 남아있는 항목들을 모은다. 두 가지 액션:
//
//   - [업로드] : 3-step S3 업로드 (presigned URL → PUT → PATCH).
//                성공 시 LocalAudio 가 사라지고 행이 목록에서 빠진다.
//   - [삭제]   : 로컬 오디오 파일만 제거. 서버 records 는 유지되며
//                audio_s3_key 는 영원히 null 로 남는다 (텍스트 기록만 유지).
//
// 업로드 / 삭제 모두 명시적으로 사용자가 결정해야 한다 — 자동 동기화
// 없음.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
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
  // The created_at coming back from the server is RFC3339; the locally
  // generated one is also ISO-ish. We format to "M월 D일 HH:mm" without
  // pulling a date library in.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}월 ${day}일 ${hh}:${mm}`;
}

function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec === 0 ? `${m}분` : `${m}분 ${sec}초`;
}

export default function DraftsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LocalAudio[] | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    const list = await draftStore.list();
    setItems(list);
  }, []);

  // useFocusEffect re-fetches every time the screen becomes visible:
  // record-audio-review may have just added a row, or another flow
  // may have removed one. Cheap call — list is small and on-disk.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleUpload = useCallback(
    async (item: LocalAudio) => {
      setBusy((prev) => ({ ...prev, [item.record_id]: true }));
      try {
        const result = await uploadAudio(item.record_id);
        if (result.status === 'failed') {
          console.error('audio upload failed', result.error);
          Alert.alert('업로드를 마치지 못했어요', '잠시 후 다시 시도해 주세요.');
        }
      } finally {
        setBusy((prev) => {
          const next = { ...prev };
          delete next[item.record_id];
          return next;
        });
        await refresh();
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    (item: LocalAudio) => {
      Alert.alert(
        '음성 파일을 삭제할까요?',
        '이 음성 파일은 이 기기에서 삭제되며, 서버에는 저장되지 않습니다. 텍스트 기록은 그대로 유지돼요.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              await draftStore.remove(item.record_id);
              await refresh();
            },
          },
        ],
      );
    },
    [refresh],
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="drafts-screen"
    >
      <View style={styles.topbar}>
        <Pressable
          accessibilityRole="button"
          onPress={handleBack}
          hitSlop={8}
          testID="drafts-back"
        >
          <Text variant="body" color="secondary">
            닫기
          </Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text variant="h2" color="primary">
          음성 원본 보관함
        </Text>
        <Text variant="emotion" color="secondary" style={styles.subtitle}>
          업로드하면 다른 기기에서도 이 목소리를 들으실 수 있어요.
        </Text>
      </View>

      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.coral} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text variant="body" color="muted" testID="drafts-empty">
            보관 중인 음성 원본이 없어요
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.record_id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
          renderItem={({ item }) => {
            const rowBusy = busy[item.record_id] || item.upload_status === 'uploading';
            return (
              <Card
                surface="ivory"
                padding="md"
                testID={`drafts-item-${item.record_id}`}
              >
                <View style={styles.rowHead}>
                  <Text variant="caption" color="secondary">
                    {formatDate(item.created_at)} · {formatDuration(item.audio_duration_ms)}
                  </Text>
                  {item.upload_status === 'failed' ? (
                    <Badge label="실패" variant="secondary" />
                  ) : item.upload_status === 'uploading' ? (
                    <Badge label="업로드 중" variant="secondary" />
                  ) : null}
                </View>
                <Text variant="body" color="primary" style={styles.preview}>
                  {item.transcript_preview || '(본문 미리보기 없음)'}
                </Text>
                <View style={styles.actions}>
                  <View style={styles.actionItem}>
                    <Button
                      title={rowBusy ? '진행 중…' : '업로드'}
                      leading="☁️"
                      variant="primary"
                      fullWidth
                      disabled={rowBusy}
                      onPress={() => handleUpload(item)}
                      testID={`drafts-upload-${item.record_id}`}
                    />
                  </View>
                  <View style={styles.actionItem}>
                    <Button
                      title="삭제"
                      leading="🗑"
                      variant="secondary"
                      fullWidth
                      disabled={rowBusy}
                      onPress={() => handleDelete(item)}
                      testID={`drafts-delete-${item.record_id}`}
                    />
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  topbar: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
  subtitle: { marginTop: spacing[1] },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  list: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: { marginTop: spacing[2], marginBottom: spacing[3] },
  actions: { flexDirection: 'row', gap: spacing[3] },
  actionItem: { flex: 1 },
});
