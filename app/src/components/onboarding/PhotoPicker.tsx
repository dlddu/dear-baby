// PhotoPicker — child photo input shown on B2 / C2 entry screens. Wraps
// expo-image-picker (gallery only — camera capture is out of scope for
// onboarding) and runs the two-step uploadChildPhoto pipeline. When the
// upload succeeds the parent receives both the temp key (sent to the
// server) and the local URI (cached in the draft for re-render after
// app restart). On failure we stay on the same row and show a retry
// affordance.
//
// Visual layout follows docs/wireframes/onboarding/case-b.svg /
// case-c.svg: a small (~96px) dashed circle with a "+" inside, and a
// "사진 추가 (선택)" caption rendered below the circle.
//
// The component is deliberately stateless about the draft store so that
// the funnel screen owns the persistence and we can test the picker
// behavior in isolation.

import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

import { uploadChildPhoto } from '../../onboarding/uploadPhoto';
import { useCaseAccent } from './CaseAccentTheme';

export type PhotoPickerProps = {
  // Existing values from the draft. localUri is what the user picked
  // in a previous session; photoTmpKey is set if the upload finished.
  localUri?: string;
  photoTmpKey?: string;
  onUploaded: (result: { photo_tmp_key: string; local_uri: string }) => void;
  onClear?: () => void;
  testID?: string;
};

type Status = 'idle' | 'picking' | 'uploading' | 'failed';

const SIZE = 96;

export function PhotoPicker({
  localUri,
  photoTmpKey,
  onUploaded,
  onClear,
  testID,
}: PhotoPickerProps) {
  const { color } = useCaseAccent();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const onPick = useCallback(async () => {
    setError(null);
    setStatus('picking');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setStatus('failed');
      setError('사진 접근 권한이 필요해요. 설정에서 허용해 주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) {
      setStatus('idle');
      return;
    }
    const uri = result.assets[0].uri;
    setStatus('uploading');
    const upload = await uploadChildPhoto(uri);
    if (upload.status === 'uploaded') {
      setStatus('idle');
      onUploaded({ photo_tmp_key: upload.photo_tmp_key, local_uri: uri });
      return;
    }
    setStatus('failed');
    setError(upload.error || '사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.');
  }, [onUploaded]);

  const hasPhoto = !!localUri && (!!photoTmpKey || status === 'idle');
  const busy = status === 'picking' || status === 'uploading';

  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        onPress={onPick}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="사진 추가"
        style={({ pressed }) => [
          styles.tile,
          hasPhoto
            ? { borderStyle: 'solid', borderColor: color }
            : { borderStyle: 'dashed', borderColor: colors.text.muted },
          pressed && styles.tilePressed,
        ]}
      >
        {hasPhoto && localUri ? (
          <Image source={{ uri: localUri }} style={styles.preview} />
        ) : (
          <Text variant="h2" color="muted" style={styles.plus}>
            +
          </Text>
        )}
      </Pressable>
      <Text variant="caption" color="muted" style={styles.caption}>
        {busy ? '올리는 중…' : '사진 추가 (선택)'}
      </Text>
      {error ? (
        <Text variant="caption" color="coral" style={styles.error} testID="photo-picker-error">
          {error}
        </Text>
      ) : null}
      {hasPhoto && onClear ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}
        >
          <Text variant="caption" color="secondary">
            사진 지우기
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2], alignItems: 'center' },
  tile: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    backgroundColor: colors.bg.beige,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePressed: { opacity: 0.85 },
  preview: { width: '100%', height: '100%' },
  plus: { fontWeight: '300', lineHeight: 36 },
  caption: { textAlign: 'center' },
  error: { textAlign: 'center', maxWidth: 220 },
  clear: { paddingVertical: spacing[1] },
  clearPressed: { opacity: 0.6 },
});
