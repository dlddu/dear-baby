// PRD-007 AC-007-01 의 헤더 컨텍스트 라벨 포맷터.
//
// 임산부 모드:
//   - 잔여일 ≥ 101  → `{weeks}주차`  (예: "28주차")
//   - 잔여일 ≤ 100  → `D-{days}`     (예: "D-36")
//   - 계산 규칙은 docs/engineering/pregnancy-week-calc.md 의 LMP 기준
//     (만삭 = 280일 = 40주). 잔여일이 음수(과거)거나 calcPregnancy 의
//     허용 범위를 벗어나면 null 반환 — 그 시점에는 헤더가 child 모드로
//     스왑되어야 한다 (출산 전환 플로우의 책임).
//
// 양육자 모드:
//   - 누적 개월 ≤ 12 → `{months}개월 ({days}일째)`  (예: "5개월 (152일째)")
//   - 누적 개월 ≥ 13 → `{floor(months/12)}살 ({days}일째)` (예: "2살 (760일째)")
//   - "n일째" 는 출생일을 1일째로 센다 — 한국 baby-tracker 관례.
//   - 양육 라벨은 `calcPregnancy` 처럼 막아둔 상·하한이 없다. 미래 birthDate
//     (입력 오류) 만 null 로 막는다.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GESTATION_DAYS = 280;
const PREGNANCY_FUTURE_CAP_DAYS = 7 * 45; // Stage 1 피커 상한 45주
const PREGNANCY_PAST_CAP_DAYS = 7 * 5; // 5주 이상 과거 due_date 는 방치로 간주

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseLocalDate(date: string): Date | null {
  const [y, m, d] = date.split('-').map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatPregnancyLabel(
  dueDate: string | null,
  now: Date = new Date(),
): string | null {
  if (!dueDate) return null;
  const due = parseLocalDate(dueDate);
  if (!due) return null;
  const today = startOfLocalDay(now);
  const daysUntilDue = Math.round(
    (due.getTime() - today.getTime()) / MS_PER_DAY,
  );
  // 과거 / 미래 극단 입력 방어 — calcPregnancy 와 동일한 경계 정책.
  if (daysUntilDue < -PREGNANCY_PAST_CAP_DAYS) return null;
  if (daysUntilDue > PREGNANCY_FUTURE_CAP_DAYS) return null;
  if (daysUntilDue < 0) return null;
  if (daysUntilDue <= 100) {
    return `D-${daysUntilDue}`;
  }
  // 주차 표기는 calcPregnancy 와 동일 (floor(daysPregnant/7)). 음수 weeks 는
  // 0 으로 clamp — Stage 1 피커가 허용한 입력은 일관되게 표시한다.
  const daysPregnant = Math.max(0, GESTATION_DAYS - daysUntilDue);
  const weeks = Math.floor(daysPregnant / 7);
  return `${weeks}주차`;
}

// monthsBetween: 캘린더 기준 누적 만개월. 같은 day-of-month 가 채워지지
// 않았으면 1 감소. 출생일이 today 보다 미래면 음수가 나오므로 호출자가
// 가드한다.
function monthsBetween(birth: Date, today: Date): number {
  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months -= 1;
  return months;
}

export function formatChildAgeLabel(
  birthDate: string | null,
  now: Date = new Date(),
): string | null {
  if (!birthDate) return null;
  const birth = parseLocalDate(birthDate);
  if (!birth) return null;
  const today = startOfLocalDay(now);
  const daysSinceBirth = Math.floor(
    (today.getTime() - birth.getTime()) / MS_PER_DAY,
  );
  if (daysSinceBirth < 0) return null;
  // 출생일 = 1일째 (한국 baby-tracker 관례).
  const dayOrdinal = daysSinceBirth + 1;
  const months = monthsBetween(birth, today);
  if (months <= 12) {
    return `${Math.max(0, months)}개월 (${dayOrdinal}일째)`;
  }
  const years = Math.floor(months / 12);
  return `${years}살 (${dayOrdinal}일째)`;
}
