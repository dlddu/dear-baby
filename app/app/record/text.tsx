// Text-only capture flow — PRD-001 AC-001-04. Produces a `Record` with
// `type: 'text'` that is saved through the same storage layer as voice
// records, so the records tab (AC-001-05) renders both uniformly.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import { newRecordId } from '../../src/records/id';
import { saveRecord } from '../../src/records/storage';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';

export default function TextRecordScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await saveRecord({
      id: newRecordId(),
      type: 'text',
      text: text.trim(),
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    router.replace('/(tabs)/records');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="h2" color="primary">
          텍스트로 작성
        </Text>
        <Text variant="emotion" color="secondary" style={styles.subtitle}>
          엄마의 마음을 글로 전해주세요 ✨
        </Text>

        <Badge label="직접 작성" variant="secondary" />

        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="오늘 아기에게 하고 싶은 이야기를 적어주세요."
          placeholderTextColor={colors.text.muted}
          style={styles.textarea}
          testID="text-record-input"
          autoFocus
        />

        <Button
          title={saving ? '저장 중…' : '기록 저장'}
          onPress={save}
          disabled={saving || !text.trim()}
          fullWidth
          testID="text-save-btn"
        />
        <Button
          title="취소"
          variant="secondary"
          onPress={() => router.back()}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.cream },
  scroll: {
    padding: spacing[5],
    gap: spacing[3],
  },
  subtitle: { marginBottom: spacing[3] },
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
