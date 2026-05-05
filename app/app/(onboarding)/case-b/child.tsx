// B2 — 양육 아이 정보 (이름·성별·생년월일·한줄 소개·사진).
// child_count 만큼 반복.

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  DateField,
  GenderPicker,
  OnboardingScreen,
  PhotoPicker,
  TextField,
  type PhotoPickerValue,
} from '../../../src/components/onboarding';
import { Text } from '../../../src/components/Text';
import { spacing } from '../../../src/theme/spacing';
import {
  loadDraft,
  upsertChild,
} from '../../../src/onboarding/draft';

import type { ChildGender } from '../../../src/api/onboarding';

const TODAY = new Date();
const MIN_BIRTH = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 25);
  return d;
})();

const ORDINAL = ['첫째', '둘째', '셋째', '넷째', '다섯째'];

export default function CaseBChild() {
  const params = useLocalSearchParams<{ index?: string }>();
  const idx = Number(params.index ?? '0');
  const router = useRouter();

  const [name, setName] = useState('');
  const [gender, setGender] = useState<ChildGender | undefined>(undefined);
  const [birth, setBirth] = useState<string | null>(null);
  const [intro, setIntro] = useState('');
  const [photo, setPhoto] = useState<PhotoPickerValue | undefined>(undefined);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    void loadDraft().then((d) => {
      setTotal(d.child_count ?? 1);
      const c = d.children[idx];
      if (!c) return;
      setName(c.display_name ?? '');
      setGender(c.gender);
      setBirth(c.birth_date ?? null);
      setIntro(c.introduction ?? '');
      if (c.photo_tmp_key && c.photo_format && c.photo_local_uri) {
        setPhoto({
          photo_tmp_key: c.photo_tmp_key,
          format: c.photo_format,
          local_uri: c.photo_local_uri,
        });
      } else {
        setPhoto(undefined);
      }
    });
  }, [idx]);

  useFocusEffect(
    useCallback(() => {
      void loadDraft();
    }, [idx]),
  );

  const isValid = name.trim() !== '' && gender !== undefined && birth !== null;

  const onNext = async () => {
    if (!isValid || gender === undefined) return;
    await upsertChild(idx, {
      kind: 'child',
      display_name: name.trim(),
      gender,
      birth_date: birth ?? undefined,
      introduction: intro.trim() || undefined,
      photo_tmp_key: photo?.photo_tmp_key,
      photo_format: photo?.format,
      photo_local_uri: photo?.local_uri,
    });
    if (idx + 1 < total) {
      router.replace({
        pathname: '/(onboarding)/case-b/child',
        params: { index: String(idx + 1) },
      });
    } else {
      router.push('/(onboarding)/case-b/intro2');
    }
  };

  const ctaTitle = idx + 1 < total ? `다음 아이 (${idx + 2}/${total})` : '다음';
  const ord = ORDINAL[idx] ?? `${idx + 1}번째`;

  return (
    <OnboardingScreen
      case="B"
      step={3}
      totalSteps={7}
      progressLabel="Case B · 1단계 ②"
      repeat={{ current: idx + 1, total }}
      cta={{ title: ctaTitle, onPress: onNext, disabled: !isValid, testID: 'b2-next' }}
      testID="onboarding-b2"
    >
      <Text variant="h2" color="primary">
        {ord} 아이 정보
      </Text>
      <PhotoPicker value={photo} onChange={setPhoto} testID="b2-photo" />
      <TextField
        label="이름"
        value={name}
        onChangeText={setName}
        placeholder="아이 이름"
        testID="b2-name"
      />
      <View style={{ gap: spacing[2] }}>
        <Text variant="caption" color="secondary">
          성별
        </Text>
        <GenderPicker value={gender} onChange={setGender} testID="b2-gender" />
      </View>
      <DateField
        label="생년월일"
        value={birth}
        onChange={setBirth}
        minimumDate={MIN_BIRTH}
        maximumDate={TODAY}
        testID="b2-birth"
      />
      <TextField
        label="한줄 소개"
        caption="(선택)"
        value={intro}
        onChangeText={setIntro}
        multiline
        placeholder="예: 잘 웃는 첫째"
        testID="b2-intro"
      />
    </OnboardingScreen>
  );
}
