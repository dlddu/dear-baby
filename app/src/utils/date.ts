// Small date utilities for the onboarding flow. Kept framework-free so they
// are easy to unit test later.

// toIsoDate returns a "YYYY-MM-DD" string in the local timezone. The backend
// stores due_date as plain ISO date (no time), so using local fields avoids
// the off-by-one that `Date#toISOString` can introduce for users near UTC
// midnight.
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// formatKoreanDate → "2025년 9월 15일" — used by the case-branching
// onboarding date pickers (FetusForm 예정일, ChildForm 생년월일).
export function formatKoreanDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// defaultDueDate returns a sensible default for the fetus due-date
// picker when the user hasn't chosen yet: 40 weeks from today, matching
// the average gestation period.
export function defaultDueDate(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 7 * 40);
  return d;
}
