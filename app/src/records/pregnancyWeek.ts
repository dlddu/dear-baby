// Utilities to bucket records by pregnancy week (PRD-001 AC-001-05 + PRD-002).
//
// "임신 주차" is calculated against the due date. Until the onboarding
// flow captures the due date (PRD-002 AC-002-02), we fall back to an
// undefined-due-date mode that groups by the ISO calendar week of the
// record's `createdAt`. That still satisfies the PRD-001 acceptance
// criteria ("주차별로 기록 목록을 확인할 수 있다") and the real
// pregnancy-week calculation can slot in transparently later.

import type { Record } from './types';

export type RecordGroup = {
  /** Stable key for list rendering — e.g. `pregnancy:17` or `iso:2026-W16`. */
  key: string;
  /** Korean-language header shown to the user. */
  label: string;
  records: Record[];
};

/**
 * Returns the ISO week label (`YYYY-Www`) of the given date using the
 * ISO-8601 definition — Monday is the first day of the week and week 1 of
 * a year is the one containing its first Thursday.
 */
export function isoWeek(date: Date): { year: number; week: number } {
  // Copy so we don't mutate the caller's Date.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Shift to Thursday of the current week — this is what the ISO spec
  // uses to anchor year boundaries.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: d.getUTCFullYear(), week };
}

/**
 * Returns the full ("40주 기준") pregnancy week/day the given date falls on,
 * given the due date. Returns `null` when the due date is unknown or the
 * math produces a nonsensical (>42 weeks, <0 weeks) answer.
 *
 * Convention: 40 weeks (280 days) before the due date is "0주 0일".
 */
export function pregnancyWeekOn(
  date: Date,
  dueDate: Date | null,
): { week: number; day: number } | null {
  if (!dueDate) return null;
  const msPerDay = 86400000;
  const daysBeforeDue = Math.floor(
    (dueDate.getTime() - date.getTime()) / msPerDay,
  );
  const totalDays = 280 - daysBeforeDue;
  if (totalDays < 0 || totalDays > 308) return null;
  return {
    week: Math.floor(totalDays / 7),
    day: totalDays % 7,
  };
}

/**
 * Groups records by week — either pregnancy week (when `dueDate` is given)
 * or ISO calendar week (fallback). Groups are returned newest-first and
 * records within each group preserve the input order.
 */
export function groupRecordsByWeek(
  records: Record[],
  dueDate: Date | null = null,
): RecordGroup[] {
  const groups = new Map<string, RecordGroup>();
  for (const record of records) {
    const created = new Date(record.createdAt);
    let key: string;
    let label: string;
    const pregnancy = pregnancyWeekOn(created, dueDate);
    if (pregnancy) {
      key = `pregnancy:${pregnancy.week}`;
      label = `임신 ${pregnancy.week}주`;
    } else {
      const { year, week } = isoWeek(created);
      key = `iso:${year}-W${String(week).padStart(2, '0')}`;
      label = `${year}년 ${week}주차`;
    }
    const existing = groups.get(key);
    if (existing) {
      existing.records.push(record);
    } else {
      groups.set(key, { key, label, records: [record] });
    }
  }
  // Map preserves insertion order; since `records` is already sorted
  // newest-first, the groups naturally come out newest-first.
  return Array.from(groups.values());
}
