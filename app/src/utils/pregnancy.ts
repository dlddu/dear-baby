// Pregnancy week/day calculation used by the home screen context badge
// ("임신 17주 3일") in Stage 2 of onboarding.
//
// Obstetric convention: pregnancy duration is 280 days (40 weeks) measured
// from the last menstrual period. Given the due date, the current week/day
// is `daysPregnant = 280 - daysUntilDue` expressed as (week, day).
//
// Boundary policy (incl. 45-week cap rationale and the Beulah Hunter edge
// case) is documented in docs/engineering/pregnancy-week-calc.md.

export type PregnancyProgress = {
  weeks: number;
  days: number;
  label: string;
};

// MS_PER_DAY is exported mostly to keep the magic number out of the
// calculation below where it would be visually noisy.
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GESTATION_DAYS = 280;

// startOfLocalDay strips the time portion so "days between" compares calendar
// days rather than wall-clock instants. Matches `toIsoDate` which is also
// local-date based.
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// calcPregnancy returns the current pregnancy progress, or null when the
// user has not chosen a due date ("아직 정해지지 않았어요") or when the
// computed week falls outside a plausible range (wildly past due, or an
// obviously wrong future date). Within the Stage 1 date picker's allowed
// window (today … today+45wk) the badge should always render, so negative
// daysPregnant values — possible when the user picks a due date beyond 40
// weeks out — are clamped to 0 rather than hidden.
export function calcPregnancy(
  dueDate: string | null,
  now: Date = new Date(),
): PregnancyProgress | null {
  if (!dueDate) return null;
  // "YYYY-MM-DD" → local midnight. new Date("YYYY-MM-DD") parses as UTC so
  // build the fields explicitly to stay consistent with startOfLocalDay.
  const [y, m, d] = dueDate.split('-').map((x) => Number(x));
  if (!y || !m || !d) return null;
  const due = new Date(y, m - 1, d);
  const today = startOfLocalDay(now);
  const daysUntilDue = Math.round(
    (due.getTime() - today.getTime()) / MS_PER_DAY,
  );
  const daysPregnant = GESTATION_DAYS - daysUntilDue;
  // Reject only clearly invalid inputs: due date more than ~5 weeks in the
  // past (user has almost certainly moved on) or beyond the Stage 1 picker's
  // 45-week cap.
  if (daysPregnant > GESTATION_DAYS + 35) return null;
  if (daysPregnant < -(7 * 5)) return null;
  const clamped = Math.max(0, daysPregnant);
  const weeks = Math.floor(clamped / 7);
  const days = clamped % 7;
  return { weeks, days, label: `임신 ${weeks}주 ${days}일` };
}
