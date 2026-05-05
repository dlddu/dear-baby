// PhotoPicker is the dashed-circle "+ 사진 추가" affordance from the
// case-branching onboarding wireframes (B2 양육 아이 정보, C2 아이 정보).
// Tap → expo-image-picker → uploadPhoto → photoTmpKey returned to the
// parent.
//
// Wireframe: docs/wireframes/onboarding/case-{b,c}.svg.

import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { uploadPhoto } from '../../onboarding/uploadPhoto';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

import { useCaseAccent } from './CaseAccentTheme';

export type PhotoPickerProps = {
  /** Local file uri (file://...) of the picked photo. Empty when none. */
  photoLocalUri?: string;
  /** Server-side tmp key once upload finished. Unused by the picker — kept here so callers can pass-through. */
  photoTmpKey?: string;
  /** Called when both pick + upload succeed. */
  onUploaded: (photoTmpKey: string, localUri: string) => void;
  /** Called when the user picks a photo but the upload fails. The local uri is still returned so the picker shows it. */
  onPickedLocal?: (localUri: string) => void;
  /** "사진 추가 (선택)" — overrideable for the iconography. */
  caption?: string;
};

const SIZE = 96;

export function PhotoPicker({
  photoLocalUri,
  onUploaded,
  onPickedLocal,
  caption = '사진 추가 (선택)',
}: PhotoPickerProps) {
  const accent = useCaseAccent();
  const [status, setStatus] = useState<'idle' | 'uploading' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onPress = async () => {
    if (status === 'uploading') return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('사진 라이브러리 접근 권한이 필요해요');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const localUri = result.assets[0].uri;
    onPickedLocal?.(localUri);
    setStatus('uploading');
    setError(null);
    const upload = await uploadPhoto(localUri);
    if (upload.status === 'uploaded') {
      onUploaded(upload.photoTmpKey, localUri);
      setStatus('idle');
    } else {
      setError('업로드에 실패했어요. 다시 시도해 주세요.');
      setStatus('failed');
    }
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={photoLocalUri ? '사진 다시 선택' : caption}
        style={({ pressed }) => [
          styles.frame,
          { borderColor: accent.bar, backgroundColor: accent.bg },
          pressed && styles.pressed,
        ]}
      >
        {photoLocalUri ? (
          <Image source={{ uri: photoLocalUri }} style={styles.image} />
        ) : (
          <Text variant="h2" style={{ color: accent.text }}>
            +
          </Text>
        )}
      </Pressable>
      <Text variant="caption" color="secondary" style={styles.caption}>
        {status === 'uploading' ? '업로드 중…' : caption}
      </Text>
      {error ? (
        <Text variant="caption" color="coral" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: spacing[2] },
  frame: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.full,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  image: { width: SIZE, height: SIZE, borderRadius: radius.full },
  caption: { textAlign: 'center' },
  error: { textAlign: 'center' },
});
