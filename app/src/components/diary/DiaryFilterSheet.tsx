// DiaryFilterSheet — M-42 의 필터 시트. 아이 다중 선택(다자녀일 때만 노출)
// + 공개 여부 단일 선택. 초기화·적용 버튼 두 개.
//
// MVP 범위에서 기간·미디어 필터는 노출하지 않는다 (PRD-008 후속 검토 항목).
// 세션 유지: 일기 탭 이탈 시 초기화 — 화면-로컬 useState 로 관리하므로 본
// 컴포넌트가 직접 관여하지 않는다.

import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { RecordVisibility } from '../../api/types';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

export type DiaryFilterChild = {
  subjectId: string;
  emoji: string;
  name: string;
};

export type DiaryFilterValue = {
  subjectIds: string[];
  visibility: RecordVisibility | null;
};

export type DiaryFilterSheetProps = {
  visible: boolean;
  /** 다자녀가 아니면 아이 칩 섹션이 통째로 숨겨진다. 두 명 이상일 때만 노출. */
  childOptions: DiaryFilterChild[];
  value: DiaryFilterValue;
  onClose: () => void;
  onApply: (next: DiaryFilterValue) => void;
};

const EMPTY: DiaryFilterValue = { subjectIds: [], visibility: null };

export function DiaryFilterSheet({
  visible,
  childOptions,
  value,
  onClose,
  onApply,
}: DiaryFilterSheetProps) {
  // 시트 안의 임시 상태 — 적용 누르기 전까지는 외부에 반영되지 않는다.
  const [draft, setDraft] = useState<DiaryFilterValue>(value);

  // 외부 value 가 바뀌거나 시트가 다시 열릴 때마다 동기화.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const toggleChild = (subjectId: string) => {
    setDraft((d) => {
      const has = d.subjectIds.includes(subjectId);
      return {
        ...d,
        subjectIds: has
          ? d.subjectIds.filter((s) => s !== subjectId)
          : [...d.subjectIds, subjectId],
      };
    });
  };

  const setVisibility = (v: RecordVisibility | null) =>
    setDraft((d) => ({ ...d, visibility: v }));

  const activeCount =
    draft.subjectIds.length + (draft.visibility !== null ? 1 : 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="diary-filter-sheet"
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.dragHandle} />
          <View style={styles.headerRow}>
            <Text variant="h3" color="primary">
              필터
            </Text>
            {activeCount > 0 ? (
              <Text variant="micro" color="coral" style={styles.activeCount}>
                {activeCount}개 적용
              </Text>
            ) : null}
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {childOptions.length >= 2 ? (
              <View style={styles.section}>
                <Text variant="micro" color="secondary" style={styles.sectionTitle}>
                  아이
                </Text>
                <View style={styles.chips}>
                  {childOptions.map((c) => {
                    const active = draft.subjectIds.includes(c.subjectId);
                    // 단일 string 으로 합쳐 Android 접근성 트리에서 한 노드
                    // 로 노출되도록 한다 — `assertVisible: "하준"` 같은
                    // text matcher 가 정상 동작.
                    const label = `${c.emoji} ${c.name}${active ? ' ✓' : ''}`;
                    return (
                      <Pressable
                        key={c.subjectId}
                        onPress={() => toggleChild(c.subjectId)}
                        accessibilityRole="button"
                        style={[
                          styles.chip,
                          active ? styles.chipActive : styles.chipInactive,
                        ]}
                        testID={`diary-filter-child-${c.subjectId}`}
                      >
                        <Text
                          variant="micro"
                          color={active ? 'onPrimary' : 'primary'}
                          style={styles.chipText}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text variant="micro" color="secondary" style={styles.sectionTitle}>
                공개 여부
              </Text>
              <View style={styles.chips}>
                <VisibilityChip
                  label="전체"
                  active={draft.visibility === null}
                  onPress={() => setVisibility(null)}
                  testID="diary-filter-visibility-all"
                />
                <VisibilityChip
                  label="🌐 공개만"
                  active={draft.visibility === 'public'}
                  onPress={() => setVisibility('public')}
                  testID="diary-filter-visibility-public"
                />
                <VisibilityChip
                  label="🔒 비공개만"
                  active={draft.visibility === 'private'}
                  onPress={() => setVisibility('private')}
                  testID="diary-filter-visibility-private"
                />
              </View>
            </View>

            <Text variant="micro" color="muted" style={styles.hint}>
              필터는 일기 탭을 이탈하면 초기화돼요 (세션 단위 유지)
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={() => setDraft(EMPTY)}
              accessibilityRole="button"
              style={[styles.footerButton, styles.resetButton]}
              testID="diary-filter-reset"
            >
              <Text variant="body" color="secondary" style={styles.footerText}>
                초기화
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onApply(draft)}
              accessibilityRole="button"
              style={[styles.footerButton, styles.applyButton]}
              testID="diary-filter-apply"
            >
              <Text variant="body" color="onPrimary" style={styles.footerText}>
                적용{activeCount > 0 ? ` (${activeCount})` : ''}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function VisibilityChip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      testID={testID}
    >
      <Text
        variant="micro"
        color={active ? 'onPrimary' : 'primary'}
        style={styles.chipText}
      >
        {label}
      </Text>
    </Pressable>
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
    maxHeight: '88%',
    paddingTop: spacing[2],
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bg.beige,
  },
  activeCount: { fontWeight: '600' },
  scroll: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[5],
  },
  section: { gap: spacing[2] },
  sectionTitle: { fontWeight: '700' },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  chipActive: {
    backgroundColor: colors.primary.coral,
  },
  chipInactive: {
    backgroundColor: colors.bg.cream,
    borderWidth: 1,
    borderColor: colors.bg.beige,
  },
  chipText: { fontWeight: '500' },
  hint: { lineHeight: 16 },
  footer: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.bg.beige,
  },
  footerButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: colors.bg.cream,
    borderWidth: 1,
    borderColor: colors.bg.beige,
  },
  applyButton: {
    flex: 2,
    backgroundColor: colors.primary.coral,
    ...shadows.soft,
  },
  footerText: { fontWeight: '700' },
});
