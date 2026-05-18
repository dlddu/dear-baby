// DiaryActionSheet — M-38 의 ⋯ 액션 시트. 슬라이드 업 RN Modal 로 구현.
// 편집·공개 토글·삭제·취소 4 액션. 공개 토글 라벨은 현재 visibility 에
// 따라 "공개로 전환" / "비공개로 전환" 으로 분기.

import { Modal, Pressable, StyleSheet, View } from 'react-native';

import type { RecordVisibility } from '../../api/types';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

export type DiaryActionSheetProps = {
  visible: boolean;
  visibility: RecordVisibility;
  onClose: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
};

export function DiaryActionSheet({
  visible,
  visibility,
  onClose,
  onEdit,
  onToggleVisibility,
  onDelete,
}: DiaryActionSheetProps) {
  const toggleLabel =
    visibility === 'private' ? '🌐 공개로 전환' : '🔒 비공개로 전환';
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        testID="diary-action-sheet"
      >
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.dragHandle} />
          <Text variant="micro" color="muted" style={styles.title}>
            기록 관리
          </Text>
          <SheetButton
            label="✏️ 편집"
            onPress={onEdit}
            testID="diary-action-edit"
          />
          <SheetButton
            label={toggleLabel}
            onPress={onToggleVisibility}
            testID="diary-action-visibility"
          />
          <SheetButton
            label="🗑️ 삭제"
            destructive
            onPress={onDelete}
            testID="diary-action-delete"
          />
          <Pressable
            onPress={onClose}
            style={styles.cancelRow}
            accessibilityRole="button"
            testID="diary-action-cancel"
          >
            <Text variant="caption" color="secondary" style={styles.cancelText}>
              취소
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetButton({
  label,
  destructive,
  onPress,
  testID,
}: {
  label: string;
  destructive?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      testID={testID}
    >
      <Text
        variant="body"
        color={destructive ? 'coral' : 'primary'}
        style={styles.rowText}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: '#3D2E1E66', // ink 40%
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface.ivory,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing[2],
    paddingBottom: spacing[5],
    paddingHorizontal: spacing[3],
    ...shadows.elevated,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.bg.beige,
    alignSelf: 'center',
    marginBottom: spacing[2],
  },
  title: {
    textAlign: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bg.beige,
    marginBottom: spacing[1],
  },
  row: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bg.beige,
  },
  rowPressed: { backgroundColor: colors.bg.cream },
  rowText: { fontSize: 15 },
  cancelRow: {
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[1],
  },
  cancelText: { fontWeight: '600' },
});
