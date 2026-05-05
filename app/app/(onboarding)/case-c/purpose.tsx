// C3 — 기록 목적 (Case C는 모든 아이에 동일 목적 복제)
// docs/wireframes/onboarding/case-c.svg

import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '../../../src/auth/AuthContext';
import {
  OnboardingScaffold,
  PurposesPicker,
} from '../../../src/components/onboarding';
import { loadDraft, saveDraft } from '../../../src/onboarding/draft';
import type { RecordPurpose } from '../../../src/api/onboarding';
import { buildCasePayload } from '../../../src/onboarding/submit';

export default function CaseCPurposeScreen() {
  const router = useRouter();
  const { submitCaseOnboarding } = useAuth();
  const [purposes, setPurposes] = useState<RecordPurpose[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onNext = async () => {
    if (submitting || purposes.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const draft = await loadDraft();
      const children = draft.children.map((c) => ({ ...c, purposes }));
      const next = await saveDraft({ children });
      const payload = buildCasePayload(next);
      if (!payload) {
        throw new Error('입력이 비어 있어요. 처음부터 다시 진행해 주세요.');
      }
      await submitCaseOnboarding(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출 중 문제가 생겼어요.');
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScaffold
      caseKind={'C'}
      step={3}
      total={3}
      title={'어떤 목적으로 기록하시나요?'}
      subtitle={'복수 선택 가능'}
      ctaTitle={'홈으로 시작하기'}
      ctaDisabled={purposes.length === 0}
      ctaLoading={submitting}
      onCta={onNext}
      errorText={error}
      testID={'onboarding-c3'}
    >
      <PurposesPicker
        value={purposes}
        onChange={setPurposes}
        caseKind={'C'}
      />
    </OnboardingScaffold>
  );
}
