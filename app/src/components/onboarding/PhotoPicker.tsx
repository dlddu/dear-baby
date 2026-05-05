// PhotoPicker — round avatar slot used on B2 / C2 to pick + upload a
// child's profile photo. Mirrors the dashed-circle "+" affordance from
// docs/wireframes/onboarding/case-b.svg / case-c.svg.
//
// State machine:
//   idle      → user has not picked yet; shows "+ 사진 추가"
//   uploading → bytes are mid-flight; spinner overlay
//   uploaded  → preview rendered; tapping replaces
//   failed    → red border + retry hint; tap retries the upload of the
//               last-picked URI without re-prompting the picker
//
// The result returned to the parent is `photo_tmp_key` — the caller
// stashes it on the in-progress ChildDraft so SubmitCase can rotate it
// onto the permanent S3 layout.

import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { Text } from '../Text';
import { uploadChildPhoto } from '../../onboarding/uploadPhoto';

export type PhotoPickerProps = {
  /** 부모가 보관하고 있는 photo_tmp_key. 있으면 업로드 완료 상태. */
  photoTmpKey?: string | null;
  /** 마지막으로 픽한 로컬 URI. 있으면 미리보기. */
  localUri?: string | null;
  /** 업로드 성공 시 호출 — 부모는 photoTmpKey 와 localUri 를 함께 저장한다. */
  onUploaded: (photoTmpKey: string, localUri: string) => void;
  /** 업로드 실패 시 호출 — 부모는 last_error 를 보여줄 수 있다. */
  onError?: (msg: string) => void;
  testID?: string;
};

type PickerStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';

export function PhotoPicker({
  photoTmpKey,
  localUri,
  onUploaded,
  onError,
  testID,
}: PhotoPickerProps) {
  const [status, setStatus] = useState<PickerStatus>(
    photoTmpKey ? 'uploaded' : 'idle',
  );
  const [pickedUri, setPickedUri] = useState<string | null>(localUri ?? null);

  const runUpload = useCallback(
    async (uri: string) => {
      setStatus('uploading');
      try {
        const { photo_tmp_key } = await uploadChildPhoto(uri);
        setPickedUri(uri);
        setStatus('uploaded');
        onUploaded(photo_tmp_key, uri);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus('failed');
        if (onError) onError(msg);
      }
    },
    [onUploaded, onError],
  );

  const onPress = useCallback(async () => {
    if (status === 'uploading') return;
    if (status === 'failed' && pickedUri) {
      await runUpload(pickedUri);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (onError) onError('사진 접근 권한이 필요해요');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    setPickedUri(asset.uri);
    await runUpload(asset.uri);
  }, [status, pickedUri, runUpload, onError]);

  const showImage = pickedUri && (status === 'uploaded' || status === 'uploading');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="아이 사진 추가"
      accessibilityState={{ disabled: status === 'uploading' }}
      testID={testID}
      style={({ pressed }) => [
        styles.bubble,
        status === 'failed' && styles.bubbleFailed,
        pressed && styles.bubblePressed,
      ]}
    >
      {showImage ? (
        <Image source={{ uri: pickedUri }} style={styles.image} />
      ) : (
        <View style={styles.placeholder}>
          <Text variant="h3" color="muted">
            +
          </Text>
          <Text variant="caption" color="muted">
            사진 추가
          </Text>
        </View>
      )}
      {status === 'uploading' ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary.coral} />
        </View>
      ) : null}
      {status === 'failed' ? (
        <Text variant="caption" style={styles.failedHint} color="coral">
          다시 시도하기
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.bg.beige,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  bubbleFailed: {
    borderColor: colors.primary.coral,
  },
  bubblePressed: {
    opacity: 0.85,
  },
  placeholder: {
    alignItems: 'center',
    gap: spacing[1],
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  failedHint: {
    position: 'absolute',
    bottom: -spacing[5],
    left: -spacing[6],
    right: -spacing[6],
    textAlign: 'center',
  },
});
