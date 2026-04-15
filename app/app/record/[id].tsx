// Record detail — satisfies the PRD-001 AC-001-05 "tap to see full content"
// requirement. The user can also edit a stored record's text from here
// (AC-001-03 — which the PRD allows post-creation: "사용자가 직접 수정할
// 수 있다").

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import { getRecord, updateRecord } from '../../src/records/storage';
import type { Record } from '../../src/records/types';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [record, setRecord] = useState<Record | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const r = await getRecord(id);
      setRecord(r);
      setDraft(r?.text ?? '');
      setLoading(false);
    })();
  }, [id]);

  const save = async () => {
    if (!record) return;
    const next: Record = { ...record, text: draft.trim() };
    await updateRecord(next);
    setRecord(next);
    setEditing(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text variant="caption" color="muted">불러오는 중…</Text>
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.container}>
        <Text variant="h2" color="primary">기록을 찾지 못했어요</Text>
        <Button title="돌아가기" variant="secondary" onPress={() => router.back()} fullWidth />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Badge
            label={record.type === 'voice' ? '음성 기록' : '텍스트 기록'}
            variant={record.type === 'voice' ? 'category' : 'secondary'}
          />
          <Text variant="caption" color="muted">
            {formatDateTime(record.createdAt)}
          </Text>
        </View>

        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            style={styles.textarea}
            testID="record-edit-input"
          />
        ) : (
          <Text variant="body" color="primary" style={styles.body} testID="record-body">
            {record.text}
          </Text>
        )}

        {editing ? (
          <>
            <Button title="저장" onPress={save} fullWidth disabled={!draft.trim()} />
            <Button
              title="취소"
              variant="secondary"
              onPress={() => {
                setDraft(record.text);
                setEditing(false);
              }}
              fullWidth
            />
          </>
        ) : (
          <Button
            title="수정하기"
            variant="secondary"
            onPress={() => setEditing(true)}
            fullWidth
            testID="record-edit-btn"
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${month}월 ${day}일 ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.cream,
  },
  scroll: {
    padding: spacing[5],
    gap: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
  },
  textarea: {
    minHeight: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surface.ivory,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    padding: spacing[4],
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
});
