// 온보딩 입력 타입.
//
// docs/glossary.md 의 도메인 용어 표와 1:1 매칭한다. 백엔드 영속화는 본
// 단계에 포함되지 않는다 — Case A 결말은 첫 태아의 dueDate 만 백엔드의
// `users.due_date` 컬럼으로 흘려보낸다.

/** 임신 아이 수. 1·2·3+ 로 표기되지만 코드에서는 3+를 3 으로 다룬다. */
export type FetusCount = 1 | 2 | 3;

/** 태아·아이의 성별. 'unknown' 은 "아직 몰라요". */
export type Gender = 'female' | 'male' | 'unknown';

/** 태아 한 명의 입력 슬롯. 다태인 경우 배열로 들고 다닌다. */
export type FetusDraft = {
  /** 태명 — 선택 입력 */
  nickname?: string;
  /** 성별 — 선택 입력 */
  gender?: Gender;
  /** 임신 주차 — 1~45 정수 */
  pregnancyWeek?: number;
  /** 출산 예정일 — ISO 8601 date (YYYY-MM-DD) 또는 미입력 */
  dueDate?: string;
  /**
   * 기록 목적 — Case B 전용 (B6 일괄 화면). Case A·C 는 미사용 —
   * 단일 `OnboardingContext.purposes` 슬롯을 모든 태아 행에 복제한다.
   */
  purposes?: string[];
};

/** 양육 아이 수. Case B/C 의 양육 아이 입력 슬롯 카운트. 1·2·3+ 로 표기되지만 코드에서는 3+를 3 으로 다룬다. */
export type ChildCount = 1 | 2 | 3;

/** Case B/C 양육 아이 입력 슬롯. 다자녀인 경우 배열로 들고 다닌다. */
export type ChildDraft = {
  /** 이름 — 필수 입력 */
  name?: string;
  /** 성별 — 선택 입력 */
  gender?: Gender;
  /** 생년월일 — ISO 8601 date (YYYY-MM-DD) 또는 미입력 */
  birthDate?: string;
  /** 한줄소개 — 선택 입력 */
  bio?: string;
  /**
   * 기록 목적 — Case B 전용 (B2-purpose 1:1 화면). Case A·C 는 미사용 —
   * 단일 `OnboardingContext.purposes` 슬롯을 모든 양육 아이 행에 복제한다.
   */
  purposes?: string[];
};

// 기록 목적(Purpose) 칩 옵션. 라벨은 한국어 그대로 클라/API/DB 의 SoT 로 사용된다.
// PRD-006 AC-006-02·04 와 docs/glossary.md 의 `기록 목적` 행을 참조.
export type PurposeOption = {
  label: string;
  defaultSelected?: boolean;
};

/** Case A · A3 화면의 기록 목적 칩 8 가지. mockup `M06_A3_Purpose` 와 1:1 일치. */
export const CASE_A_PURPOSES: PurposeOption[] = [
  { label: '매일의 마음', defaultSelected: true },
  { label: '몸의 변화', defaultSelected: true },
  { label: '아이에게 편지' },
  { label: '꿈·예감' },
  { label: '가족 이야기' },
  { label: '병원 기록' },
  { label: '준비물 정리' },
  { label: '나만의 작명' },
];

/** Case C · C3 화면의 기록 목적 칩 8 가지. mockup `M16_C3_Purpose` 와 1:1 일치. */
export const CASE_C_PURPOSES: PurposeOption[] = [
  { label: '일상의 발견', defaultSelected: true },
  { label: '말과 행동의 성장', defaultSelected: true },
  { label: '웃긴 순간' },
  { label: '음식·취향' },
  { label: '친구와의 시간' },
  { label: '가족 이벤트' },
  { label: '병원·건강' },
  { label: '마음의 변화' },
];
