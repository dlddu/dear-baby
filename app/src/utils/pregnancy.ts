// Pregnancy week/day calculation used by the home screen context badge
// ("임신 17주 3일") in Stage 2 of onboarding.
//
// Obstetric convention: pregnancy duration is 280 days (40 weeks) measured
// from the last menstrual period. Given the due date, the current week/day
// is `daysPregnant = 280 - daysUntilDue` expressed as (week, day).

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
// computed week falls outside a plausible range (before conception, or far
// past due). Callers render nothing in that case.
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
  if (daysPregnant < 0 || daysPregnant > GESTATION_DAYS + 35) {
    return null;
  }
  const weeks = Math.floor(daysPregnant / 7);
  const days = daysPregnant % 7;
  return { weeks, days, label: `임신 ${weeks}주 ${days}일` };
}
