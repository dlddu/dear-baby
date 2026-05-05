// Recording-purpose option metadata shared by A3 / B6 / C3. Keeps the
// label copy in one place so the wireframe-faithful "아이에게 줄 책 만들기"
// stays consistent across screens.
//
// The wire value (RecordPurpose) is what the backend persists; the
// label is the on-screen copy.

import type { RecordPurpose } from '../api/onboarding';

export type PurposeOption = {
  value: RecordPurpose;
  label: string;
  /** Short caption shown under the label on bigger screens. */
  caption?: string;
};

export const PURPOSE_OPTIONS: ReadonlyArray<PurposeOption> = [
  { value: 'book_making', label: '아이에게 줄 책 만들기' },
  { value: 'memory_keeping', label: '추억 보관' },
  { value: 'family_share', label: '가족과 공유' },
  { value: 'emotion_diary', label: '감정 일기' },
];
