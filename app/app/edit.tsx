import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { createEntry, getEntry, updateEntry } from '../src/api/diary';
import { colors, radius } from '../src/theme/colors';

const CURRENT_WEEK = 17;

function formatDateTag(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${y}.${m}.${dd}`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}분 ${s.toString().padStart(2, '0')}초`;
}

export default function EditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    transcribedText?: string;
    audioUri?: string;
    duration?: string;
    entryType?: string;
  }>();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [entryType, setEntryType] = useState<'voice' | 'text'>('voice');
  const [dateTag, setDateTag] = useState(formatDateTag());
  const [duration, setDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const isExisting = !!params.id && !params.transcribedText;

  useEffect(() => {
    if (params.id && !params.transcribedText) {
      // Load existing entry
      getEntry(params.id)
        .then((entry) => {
          setTitle(entry.title);
          setContent(entry.content);
          setEntryType(entry.entry_type);
          setDateTag(formatDateTag(entry.created_at));
          if (entry.duration) setDuration(entry.duration);
        })
        .catch(() => {});
    } else if (params.transcribedText !== undefined) {
      // New entry from voice recording
      setContent(params.transcribedText);
      setEntryType((params.entryType as 'voice' | 'text') || 'voice');
      setDuration(Number(params.duration) || 0);
    }
  }, [params.id, params.transcribedText, params.entryType, params.duration]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      if (isExisting && params.id) {
        await updateEntry(params.id, { title, content });
      } else {
        await createEntry({
          title,
          content,
          entry_type: entryType,
          week: CURRENT_WEEK,
          duration: entryType === 'voice' ? duration : undefined,
        });
      }
      router.dismissAll();
      router.navigate('/(tabs)');
    } catch {
      Alert.alert('저장 실패', '기록을 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>기록 편집</Text>
        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>저장</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} keyboardDismissMode="interactive">
        {/* Meta tags */}
        <View style={styles.metaRow}>
          <View style={styles.metaTag}>
            <Text style={styles.metaText}>📅 {dateTag}</Text>
          </View>
          <View style={styles.metaTag}>
            <Text style={styles.metaText}>
              {entryType === 'voice' ? '🎙️ 음성 기록' : '✏️ 텍스트 기록'}
            </Text>
          </View>
        </View>

        {/* Title input */}
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="제목을 입력하세요"
          placeholderTextColor={colors.textLight}
        />

        {/* Content textarea */}
        <TextInput
          style={styles.textarea}
          value={content}
          onChangeText={setContent}
          placeholder="아기에게 전하고 싶은 이야기를 자유롭게 적어보세요..."
          placeholderTextColor={colors.textLight}
          multiline
          textAlignVertical="top"
        />

        {/* Voice playback tag */}
        {entryType === 'voice' && duration > 0 && (
          <View style={styles.voiceTag}>
            <Text style={{ fontSize: 14 }}>▶️</Text>
            <Text style={styles.voiceTagText}>
              음성 원본 재생 · {formatDuration(duration)}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgCream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 28, color: colors.textSecondary },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: colors.accentPeach,
    borderRadius: radius.sm,
  },
  saveBtnText: { fontSize: 14, fontWeight: '500', color: '#fff' },
  body: { flex: 1, paddingHorizontal: 24 },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  metaTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.accentSoftPink,
    borderRadius: 20,
  },
  metaText: { fontSize: 12, fontWeight: '500', color: colors.accentRose },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
    paddingVertical: 4,
  },
  textarea: {
    minHeight: 240,
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    fontSize: 15,
    lineHeight: 27,
    color: colors.textPrimary,
  },
  voiceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.bgWarm,
    borderRadius: radius.sm,
  },
  voiceTagText: { fontSize: 13, color: colors.textSecondary },
});
