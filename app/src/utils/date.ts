// Small date utilities used by the onboarding date pickers.

// toIsoDate returns a "YYYY-MM-DD" string in the local timezone. The
// backend stores all date-only fields as plain ISO date (no time), so
// using local fields avoids the off-by-one that `Date#toISOString` can
// introduce for users near UTC midnight.
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// formatKoreanDate → "2025년 9월 15일" per the Korean date convention
// used throughout the case-onboarding wireframes.
export function formatKoreanDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
