// B2 — 양육 아이 정보 입력 (반복)
// docs/wireframes/onboarding/case-b.svg

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  DateField,
  GenderPicker,
  LabeledField,
  OnboardingScaffold,
  PhotoPicker,
  RepeatBadge,
  TextField,
} from '../../../src/components/onboarding';
import {
  loadDraft,
  saveDraft,
  updateChild,
} from '../../../src/onboarding/draft';
import type { Gender } from '../../../src/api/onboarding';
import type { ChildDraft } from '../../../src/onboarding/draft';
import type { UploadedPhoto } from '../../../src/onboarding/uploadPhoto';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBChildScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ idx?: string }>();
  const idx = Number(params.idx ?? '0');

  const [photo, setPhoto] = useState<UploadedPhoto | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [intro, setIntro] = useState('');
  const [parentingTotal, setParentingTotal] = useState(1);

  useEffect(() => {
    void loadDraft().then((d) => {
      const parenting = d.children.filter((c) => c.kind === 'child');
      setParentingTotal(parenting.length || 1);
      const c: ChildDraft | undefined = parenting[idx];
      if (c) {
        setName(c.displayName ?? '');
        setGender(c.gender ?? null);
        setBirthDate(c.birthDate ?? null);
        setIntro(c.introduction ?? '');
        if (c.photoTmpKey && c.localPhotoUri) {
          setPhoto({ photoTmpKey: c.photoTmpKey, localUri: c.localPhotoUri });
        }
      }
    });
  }, [idx]);

  const ready = !!name.trim() && !!gender && !!birthDate;

  const onNext = async () => {
    if (!ready) return;
    // The parenting drafts are at array indices [0 .. parentingTotal-1].
    await updateChild(idx, {
      kind: 'child',
      displayName: name.trim(),
      gender: gender as Gender,
      birthDate: birthDate as string,
      introduction: intro.trim() || undefined,
      photoTmpKey: photo?.photoTmpKey,
      localPhotoUri: photo?.localUri,
    });
    if (idx + 1 < parentingTotal) {
      await saveDraft({ lastStep: '/(onboarding)/case-b/child' });
      router.push({
        pathname: '/(onboarding)/case-b/child',
        params: { idx: String(idx + 1) },
      });
    } else {
      await saveDraft({ lastStep: '/(onboarding)/case-b/intro2' });
      router.push('/(onboarding)/case-b/intro2');
    }
  };

  const ctaTitle =
    parentingTotal > 1 && idx + 1 < parentingTotal
      ? `다음 아이 (${idx + 2}/${parentingTotal})`
      : '다음';
  const orderName = ordinal(idx);

  return (
    <OnboardingScaffold
      caseKind={'B'}
      step={3}
      total={7}
      labelOverride={'Case B · 1단계 ②'}
      title={parentingTotal > 1 ? `${orderName} 아이 정보` : '아이 정보를 알려주세요'}
      ctaTitle={ctaTitle}
      ctaDisabled={!ready}
      onCta={onNext}
      trailing={
        parentingTotal > 1 ? (
          <RepeatBadge
            index={idx + 1}
            total={parentingTotal}
            caseKind={'B'}
          />
        ) : null
      }
      testID={'onboarding-b2'}
    >
      <View style={styles.photoRow}>
        <PhotoPicker value={photo} onChange={setPhoto} testID={'b2-photo'} />
      </View>
      <LabeledField label={'이름'}>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder={'아이의 이름'}
          maxLength={30}
          testID={'b2-name'}
        />
      </LabeledField>
      <LabeledField label={'성별'}>
        <GenderPicker
          value={gender}
          onChange={setGender}
          caseKind={'B'}
          testID={'b2-gender'}
        />
      </LabeledField>
      <LabeledField label={'생년월일'}>
        <DateField
          value={birthDate}
          onChange={setBirthDate}
          maxDate={new Date()}
          testID={'b2-birth'}
        />
      </LabeledField>
      <LabeledField label={'한줄 소개'} optional>
        <TextField
          value={intro}
          onChangeText={setIntro}
          placeholder={'예: 잘 웃는 첫째'}
          maxLength={60}
          multiline
          testID={'b2-intro'}
        />
      </LabeledField>
    </OnboardingScaffold>
  );
}

function ordinal(idx: number): string {
  const labels = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
  return labels[idx] ?? `${idx + 1}번째`;
}

const styles = StyleSheet.create({
  photoRow: { alignItems: 'center', paddingVertical: spacing[2] },
});
