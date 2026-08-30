// PRD-009 AC-009-03 의 상단 상태값 포맷터 — "임신 20주차" / "생후 5개월" / "2살".
//
// **홈 헤더 포맷터(`childLabel.ts`)를 재사용하지 않는 이유**: 홈은
// PRD-007 AC-007-01 에 따라 출산까지 100일 이하이면 주차 대신 `D-36` 을
// 그린다. AC-009-03 의 표시 문구 표에는 그 분기가 없고 언제나 `임신 N주차`
// 다 — `formatPregnancyLabel` 을 그대로 쓰면 출산 100일 전 사용자에게만
// AC-009-03 이 조용히 어긋난다. 양육 라벨도 마찬가지로 홈은
// `5개월 (152일째)` 처럼 일째를 덧붙이지만 커뮤니티는 `생후 5개월` 이다.
//
// 대신 이 포맷터는 백엔드 `records.childStatusText`
// (backend/internal/records/community.go) 와 규칙·경계값을 1:1 로 맞춘다.
// 그 함수가 피드 카드의 "아이 현황" 을 만들기 때문에, 같은 화면에서 내
// 상태값과 남의 카드가 같은 어휘를 쓰게 된다.
//
// 계산 규칙은 ENG-001 (docs/engineering/ENG-001-pregnancy-week-calc.md): 만삭 280일,
// daysPregnant = 280 - (예정일 - 오늘), 주차 = floor(daysPregnant / 7).
// 경계 밖(과거 5주 초과·미래 45주 초과·미래 생일)이면 null 을 돌려주고,
// 화면은 그 줄을 아예 그리지 않는다 — 없는 값을 지어내지 않는다.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GESTATION_DAYS = 280;
const PREGNANCY_FUTURE_CAP_DAYS = 7 * 45;
const PREGNANCY_PAST_CAP_DAYS = 7 * 5;
// 13개월부터 "N살" 로 바뀐다 — 백엔드 childMonthsAsYearsFrom 과 같은 경계.
const MONTHS_AS_YEARS_FROM = 13;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseLocalDate(date: string): Date | null {
  const [y, m, d] = date.split('-').map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function monthsBetween(birth: Date, today: Date): number {
  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months -= 1;
  return months;
}

export type CommunityStageKind = 'fetus' | 'child';

export function formatCommunityStageLabel(
  kind: CommunityStageKind,
  dueOrBirthDate: string | null,
  now: Date = new Date(),
): string | null {
  if (!dueOrBirthDate) return null;
  const date = parseLocalDate(dueOrBirthDate);
  if (!date) return null;
  const today = startOfLocalDay(now);

  if (kind === 'fetus') {
    const daysUntilDue = Math.round(
      (date.getTime() - today.getTime()) / MS_PER_DAY,
    );
    if (daysUntilDue < -PREGNANCY_PAST_CAP_DAYS) return null;
    if (daysUntilDue > PREGNANCY_FUTURE_CAP_DAYS) return null;
    // 예정일이 만삭보다 멀면 daysPregnant 가 음수가 되는데, ENG-001 은
    // 숨기지 않고 0 으로 clamp 한다 (백엔드도 동일).
    const daysPregnant = Math.max(0, GESTATION_DAYS - daysUntilDue);
    return `임신 ${Math.floor(daysPregnant / 7)}주차`;
  }

  const months = monthsBetween(date, today);
  if (months < 0) return null;
  if (months < MONTHS_AS_YEARS_FROM) return `생후 ${months}개월`;
  return `${Math.floor(months / 12)}살`;
}
