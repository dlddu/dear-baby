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
};
