// 일기 탭 — 기록 상세 (M-38).
//
// 풀스크린 push 라 (tabs) 그룹 밖에 둔다 — 상세에서 ⋯ → 편집/삭제/공개 토글
// 까지 한 흐름이라 탭바가 보이지 않는 편이 시각 동선이 깨끗하다.
//
// useFocusEffect 로 다시 fetch — 편집 화면에서 돌아왔을 때 본문 변경이
// 반영되어야 한다. 삭제 후에는 곧바로 router.back() 해 목록으로 돌아간다.

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deleteRecord,
  getRecord,
  updateRecordVisibility,
} from '../../src/api/records';
import type { Record } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { ChildContextChip } from '../../src/components/diary/ChildContextChip';
import { DeleteConfirmModal } from '../../src/components/diary/DeleteConfirmModal';
import { DiaryActionSheet } from '../../src/components/diary/DiaryActionSheet';
import {
  describeSubject,
  formatDetailDate,
} from '../../src/components/diary/subjectLookup';
import { VisibilityBadge } from '../../src/components/diary/VisibilityBadge';
import { Text } from '../../src/components/Text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function DiaryDetailScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === 'string' ? rawId : '';
  const { user } = useAuth();

  const [record, setRecord] = useState<Record | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [visibilityPending, setVisibilityPending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void getRecord(id)
        .then((r) => {
          if (!cancelled) setRecord(r);
        })
        .catch(() => {
          if (!cancelled) setRecord(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleEdit = useCallback(() => {
    setActionSheetOpen(false);
    router.push({ pathname: '/diary/[id]/edit', params: { id } });
  }, [router, id]);

  const handleToggleVisibility = useCallback(async () => {
    if (!record || visibilityPending) return;
    setVisibilityPending(true);
    setActionSheetOpen(false);
    const next = record.visibility === 'private' ? 'public' : 'private';
    try {
      const updated = await updateRecordVisibility(record.id, next);
      setRecord(updated);
    } catch {
      Alert.alert(
        '공개 설정을 바꾸지 못했어요',
        '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setVisibilityPending(false);
    }
  }, [record, visibilityPending]);

  const handleDelete = useCallback(async () => {
    if (!record || deletePending) return;
    setDeletePending(true);
    try {
      await deleteRecord(record.id);
      setDeleteOpen(false);
      router.back();
    } catch {
      setDeletePending(false);
      Alert.alert('삭제하지 못했어요', '잠시 후 다시 시도해주세요.');
    }
  }, [record, deletePending, router]);

  if (loading && !record) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary.coral} />
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <TopBar onBack={handleBack} onMore={() => {}} disableMore />
        <View style={styles.notFound}>
          <Text variant="body" color="muted">
            기록을 찾을 수 없어요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const subj = describeSubject(user, record.subject_id, record.created_at);
  const hasAudio = record.audio_s3_key != null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']} testID="diary-detail">
      <TopBar onBack={handleBack} onMore={() => setActionSheetOpen(true)} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.metaSection}>
          <Text variant="h3" color="primary" testID="diary-detail-date">
            {formatDetailDate(record.created_at)}
          </Text>
          <View style={styles.metaChips}>
            <ChildContextChip
              emoji={subj.emoji}
              name={subj.name}
              contextLabel={subj.contextLabel}
              testID="diary-detail-subject"
            />
            <VisibilityBadge
              visibility={record.visibility}
              testID="diary-detail-visibility"
            />
          </View>
        </View>

        {hasAudio ? (
          <View style={styles.audioRow}>
            <Text variant="caption" color="coral">
              🎙️ 음성 원본 있음
            </Text>
          </View>
        ) : null}

        {record.question_text ? (
          <View style={styles.quote}>
            <Text variant="micro" color="secondary">
              {`Q. ${subj.name}가 엄마에게`}
            </Text>
            <Text variant="body" color="primary" style={styles.quoteText}>
              {record.question_text}
            </Text>
          </View>
        ) : null}

        <Text variant="body" color="primary" style={styles.body} testID="diary-detail-content">
          {record.content}
        </Text>
      </ScrollView>

      <DiaryActionSheet
        visible={actionSheetOpen}
        visibility={record.visibility}
        onClose={() => setActionSheetOpen(false)}
        onEdit={handleEdit}
        onToggleVisibility={handleToggleVisibility}
        onDelete={() => {
          setActionSheetOpen(false);
          setDeleteOpen(true);
        }}
      />
      <DeleteConfirmModal
        visible={deleteOpen}
        childName={subj.name}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        pending={deletePending}
      />
    </SafeAreaView>
  );
}

function TopBar({
  onBack,
  onMore,
  disableMore,
}: {
  onBack: () => void;
  onMore: () => void;
  disableMore?: boolean;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        hitSlop={8}
        style={styles.topIcon}
        testID="diary-detail-back"
      >
        <Text variant="body" color="secondary" style={styles.topIconGlyph}>
          ←
        </Text>
      </Pressable>
      <Text variant="caption" color="secondary">
        기록 상세
      </Text>
      <Pressable
        onPress={disableMore ? undefined : onMore}
        accessibilityRole="button"
        accessibilityLabel="더보기"
        hitSlop={8}
        style={styles.topIcon}
        testID="diary-detail-more"
        disabled={disableMore}
      >
        <Text variant="body" color="primary" style={styles.topIconGlyph}>
          ⋯
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bg.beige,
  },
  topIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topIconGlyph: { fontSize: 20, lineHeight: 24, fontWeight: '600' },
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  metaSection: {
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bg.beige,
    gap: spacing[2],
  },
  metaChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  audioRow: {
    paddingVertical: spacing[1],
  },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary.coral + 'AA',
    paddingLeft: spacing[3],
    gap: spacing[1],
  },
  quoteText: { lineHeight: 22 },
  body: {
    lineHeight: 26,
  },
});
