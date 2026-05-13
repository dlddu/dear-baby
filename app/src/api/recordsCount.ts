// Records count mock — PRD-007 AC-007-07 의 책 진행도 카운트.
//
// 백엔드 답변 카운트 API 가 아직 없으므로 결정적 stub 을 둔다. 시그니처는
// 백엔드 도착 시 그대로 유지하여 export 만 교체 가능하도록 맞췄다.
//
// 키 정책: `{kind, ordinal}` 페어를 그대로 받는다. 활성 아이의 kind·ordinal
// 은 ActiveChildContext 의 `ActiveChild` 가 이미 정규화해 둔 값이라 호출자가
// 추가 변환 없이 전달할 수 있다.
//
// fallback 값은 두 분기(`n < 50`, `n = 50`) 를 같은 mock 으로 검증할 수 있도록
// 의도적으로 다르게 설정한다 — 다자녀 사용자가 활성 아이를 전환할 때 진행도가
// 독립적으로 갱신되는 것을 데모/리뷰에서 확인하기 위함.
//   - 양육 아이 ordinal=1 → 50 (CTA 분기)
//   - 양육 아이 ordinal=2+ → 36
//   - 태아 ordinal=1 → 12 (기본 진행도)
//   - 태아 ordinal=2+ → 50 (CTA 분기, 다자녀 데모)
// 임계값 50 은 PRD-007 명시값. 상한 클램프는 호출자(BookProgress)가 책임진다.

import type { ActiveChildKind } from '../context/ActiveChildContext';

export type RecordsCountKey = {
  kind: ActiveChildKind;
  ordinal: number;
};

export async function getCountByActiveChild(
  key: RecordsCountKey,
): Promise<number> {
  if (key.kind === 'child') {
    return key.ordinal <= 1 ? 50 : 36;
  }
  // fetus
  return key.ordinal <= 1 ? 12 : 50;
}
