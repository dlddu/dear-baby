// PhotoPicker — 와이어프레임의 점선 + 원형 "사진 추가" 슬롯. Case B/C
// 의 양육 아이 정보 화면에서만 노출되며, Case A 는 사용하지 않는다.
//
// 동작:
//   1. 탭 → expo-image-picker 갤러리 선택
//   2. 선택된 로컬 URI 를 우선 보여주고, 백그라운드로 S3 업로드 시작
//   3. 성공 시 photo_tmp_key 를 onChange 로 부모에 전달
//   4. 실패 시 인라인 에러 + "다시 시도" CTA

import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { uploadPhoto } from '../../onboarding/uploadPhoto';

import type { ChildPhotoFormat } from '../../api/onboarding';

export type PhotoPickerValue = {
  photo_tmp_key: string;
  format: ChildPhotoFormat;
  local_uri: string;
};

export type PhotoPickerProps = {
  value?: PhotoPickerValue;
  onChange: (next: PhotoPickerValue | undefined) => void;
  testID?: string;
};

type State =
  | { kind: 'idle' }
  | { kind: 'uploading'; uri: string }
  | { kind: 'error'; uri: string; message: string };

export function PhotoPicker({ value, onChange, testID }: PhotoPickerProps) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const start = async (uri: string) => {
    setState({ kind: 'uploading', uri });
    try {
      const result = await uploadPhoto(uri);
      onChange({
        photo_tmp_key: result.photo_tmp_key,
        format: result.format,
        local_uri: uri,
      });
      setState({ kind: 'idle' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: 'error', uri, message });
    }
  };

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      // The OS-level perm dialog already explained why; surface a soft
      // hint so users coming back to the screen know the picker can't
      // proceed without access.
      setState({ kind: 'error', uri: '', message: '사진 접근 권한이 필요해요.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
      // iOS 는 기본 HEIC; 서버 ImageFormat 이 지원하므로 변환 없이 업로드.
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await start(asset.uri);
  };

  const clear = () => {
    setState({ kind: 'idle' });
    onChange(undefined);
  };

  // Render rules:
  //   - value 있음 + idle           → committed thumbnail
  //   - state uploading             → uploading thumbnail with spinner
  //   - state error + uri           → error thumbnail with retry
  //   - 그 외                        → empty + "사진 추가 (선택)"
  const previewUri =
    state.kind === 'uploading'
      ? state.uri
      : state.kind === 'error'
        ? state.uri
        : value?.local_uri;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="사진 추가"
        onPress={pick}
        testID={testID}
        style={({ pressed }) => [
          styles.slot,
          previewUri ? styles.slotFilled : styles.slotEmpty,
          pressed && { opacity: 0.85 },
        ]}
      >
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.image} />
        ) : (
          <Text variant="caption" color="muted">
            +
          </Text>
        )}
        {state.kind === 'uploading' ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.primary.coral} />
          </View>
        ) : null}
      </Pressable>
      <Text variant="caption" color="muted" style={styles.label}>
        {value ? '사진 변경' : '사진 추가 (선택)'}
      </Text>
      {state.kind === 'error' ? (
        <View style={styles.errorRow}>
          <Text variant="caption" color="coral" style={styles.error}>
            업로드 실패: {state.message}
          </Text>
          <View style={styles.errorActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => state.uri && start(state.uri)}
              disabled={!state.uri}
            >
              <Text variant="caption" color="coral">
                다시 시도
              </Text>
            </Pressable>
            {value ? (
              <Pressable accessibilityRole="button" onPress={clear}>
                <Text variant="caption" color="secondary">
                  지우기
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing[2] },
  slot: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slotEmpty: {
    backgroundColor: colors.bg.beige,
    borderWidth: 1,
    borderColor: colors.text.muted,
    borderStyle: 'dashed',
  },
  slotFilled: {
    backgroundColor: colors.bg.beige,
  },
  image: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
  errorRow: { gap: spacing[1], alignItems: 'center' },
  error: { textAlign: 'center' },
  errorActions: { flexDirection: 'row', gap: spacing[3] },
});
