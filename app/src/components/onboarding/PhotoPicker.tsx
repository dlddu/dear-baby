// Photo picker for the case-onboarding child screens (B2 / C2). The
// upload starts as soon as the user picks a photo; the picker tile
// shows three states:
//
//   - empty:    dashed circle with "+" / "사진 추가 (선택)"
//   - uploading: grayed circle with a small spinner
//   - uploaded:  the local image inside the circle
//   - failed:   the local image with a "재시도" overlay
//
// On uploaded, onChange fires with {photoTmpKey, localUri}. On
// remove, onChange fires with null. Photos are always optional (PRD-006
// "입력 허들 낮추는 장치"), so the parent screen never gates progression
// on this widget.

import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { uploadChildPhoto, type UploadedPhoto } from '../../onboarding/uploadPhoto';
import { Text } from '../Text';
import { colors } from '../../theme/colors';

export type PhotoPickerProps = {
  /** Current value rendered by the tile. Pass null to show the empty state. */
  value: UploadedPhoto | null;
  onChange: (next: UploadedPhoto | null) => void;
  testID?: string;
};

export function PhotoPicker({ value, onChange, testID }: PhotoPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async () => {
    if (uploading) return;
    setError(null);
    // Permission request is idempotent — Expo no-ops if already granted.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('사진 접근 권한이 필요해요');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    setUploading(true);
    try {
      const uploaded = await uploadChildPhoto(asset.uri);
      onChange(uploaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  return (
    <View style={styles.wrapper} testID={testID}>
      <Pressable
        onPress={handlePick}
        accessibilityRole="button"
        accessibilityLabel={value ? '사진 변경' : '사진 추가'}
        disabled={uploading}
        style={({ pressed }) => [
          styles.tile,
          value
            ? styles.tileFilled
            : { ...styles.tileEmpty, borderColor: colors.bg.beige },
          pressed && styles.tilePressed,
        ]}
        testID={testID ? `${testID}-tile` : undefined}
      >
        {value ? (
          <Image
            source={{ uri: value.localUri }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <Text variant="h2" color="muted">
            +
          </Text>
        )}
        {uploading && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.primary.coral} />
          </View>
        )}
      </Pressable>
      <Text
        variant="caption"
        color={error ? 'coral' : 'muted'}
        style={styles.label}
      >
        {error ?? (value ? '사진 변경' : '사진 추가 (선택)')}
      </Text>
      {value && !uploading && (
        <Pressable
          onPress={handleRemove}
          accessibilityRole="button"
          accessibilityLabel="사진 삭제"
          testID={testID ? `${testID}-remove` : undefined}
          style={styles.removeBtn}
        >
          <Text variant="caption" color="muted" style={styles.removeText}>
            삭제
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 6 },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileEmpty: {
    backgroundColor: colors.bg.beige,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  tileFilled: {
    backgroundColor: colors.bg.beige,
  },
  tilePressed: { opacity: 0.85 },
  image: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
  removeBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  removeText: { textDecorationLine: 'underline' },
});
