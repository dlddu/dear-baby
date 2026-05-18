// DeleteConfirmModal — M-41 의 슬라이드 업 시트. 본문 카피에 아이 이름 치환,
// 취소(기본)·삭제(코랄·위험) 두 버튼.

import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

export type DeleteConfirmModalProps = {
  visible: boolean;
  childName: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
};

export function DeleteConfirmModal({
  visible,
  childName,
  onCancel,
  onConfirm,
  pending = false,
}: DeleteConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.scrim}
        onPress={onCancel}
        testID="diary-delete-confirm"
      >
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.dragHandle} />
          <View style={styles.warningIcon}>
            <Text style={styles.warningGlyph}>🗑️</Text>
          </View>
          <Text variant="h3" color="primary" style={styles.title}>
            이 기록을 정말 삭제할까요?
          </Text>
          <Text variant="caption" color="secondary" style={styles.body}>
            삭제하면 기록 본문과 첨부 미디어가 모두 사라지고,{' '}
            <Text variant="caption" color="primary" style={styles.bodyEmph}>
              {childName}
            </Text>
            의 책에도 포함되지 않게 됩니다.{'\n'}
            <Text variant="caption" color="coral" style={styles.bodyEmph}>
              이 동작은 되돌릴 수 없습니다.
            </Text>
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              style={[styles.button, styles.cancelButton]}
              disabled={pending}
              testID="diary-delete-cancel"
            >
              <Text variant="body" color="primary" style={styles.cancelText}>
                취소
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              style={[
                styles.button,
                styles.confirmButton,
                pending && styles.disabledButton,
              ]}
              disabled={pending}
              testID="diary-delete-confirm-button"
            >
              <Text variant="body" color="onPrimary" style={styles.confirmText}>
                {pending ? '삭제 중…' : '삭제'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: '#3D2E1E66',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface.ivory,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing[2],
    paddingBottom: spacing[5],
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    ...shadows.elevated,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.bg.beige,
    marginBottom: spacing[3],
  },
  warningIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary.coralTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  warningGlyph: { fontSize: 24, lineHeight: 32 },
  title: { textAlign: 'center', marginBottom: spacing[2] },
  body: { textAlign: 'center', marginBottom: spacing[5], lineHeight: 22 },
  bodyEmph: { fontWeight: '600' },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[2],
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.bg.beige + 'AA',
  },
  confirmButton: {
    backgroundColor: colors.primary.coral,
    ...shadows.soft,
  },
  disabledButton: { opacity: 0.6 },
  cancelText: { fontWeight: '600' },
  confirmText: { fontWeight: '600' },
});
