// PRD-007 AC-007-01 — 활성 아이 컨텍스트 라벨 포맷터의 경계값 잠금.
// 임산부 모드의 주차/D-day 전환 (101일 vs 100일), 양육자 모드의 개월/살
// 전환 (12개월 vs 13개월), 출생 당일 (1일째) 등을 정확히 고정한다.

import {
  formatChildAgeLabel,
  formatPregnancyLabel,
} from '../childLabel';

function dayBefore(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d - days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const TODAY = new Date(2026, 4, 12); // 2026-05-12

describe('formatPregnancyLabel — TC-007-01-A·B 임산부 모드', () => {
  it('returns null when dueDate is null', () => {
    expect(formatPregnancyLabel(null, TODAY)).toBeNull();
  });

  it('returns null when dueDate is malformed', () => {
    expect(formatPregnancyLabel('not-a-date', TODAY)).toBeNull();
  });

  it('shows "주차" format when daysUntilDue is exactly 101 (boundary)', () => {
    // dueDate = today + 101일. daysPregnant = 280-101 = 179. weeks = floor(179/7) = 25.
    const due = new Date(2026, 4, 12 + 101);
    const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    expect(formatPregnancyLabel(dueStr, TODAY)).toBe('25주차');
  });

  it('shows "D-100" when daysUntilDue is exactly 100 (boundary)', () => {
    const due = new Date(2026, 4, 12 + 100);
    const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    expect(formatPregnancyLabel(dueStr, TODAY)).toBe('D-100');
  });

  it('shows "D-36" with 36 days remaining', () => {
    const due = new Date(2026, 4, 12 + 36);
    const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    expect(formatPregnancyLabel(dueStr, TODAY)).toBe('D-36');
  });

  it('shows "D-0" on the due date itself', () => {
    expect(formatPregnancyLabel('2026-05-12', TODAY)).toBe('D-0');
  });

  it('returns null when due date is more than 5 weeks past', () => {
    // 6 weeks past today.
    const past = dayBefore('2026-05-12', 7 * 6);
    expect(formatPregnancyLabel(past, TODAY)).toBeNull();
  });

  it('returns null when due date is past today (any amount)', () => {
    // 1 day past — pregnancy mode no longer applies; child mode should take over.
    expect(formatPregnancyLabel('2026-05-11', TODAY)).toBeNull();
  });

  it('shows "28주차" for a far-future due date', () => {
    // 28주차 means weeks=28 (daysPregnant=196..202). daysUntilDue = 280-196 = 84
    // ... wait, that's <= 100 so would be D-day mode. Need daysUntilDue >= 101
    // which means weeks <= 25. Let me pick a deeper future: daysUntilDue = 280-7*8 = 224
    // → weeks=8.
    const due = new Date(2026, 4, 12 + 224);
    const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    expect(formatPregnancyLabel(dueStr, TODAY)).toBe('8주차');
  });
});

describe('formatChildAgeLabel — TC-007-01-C 양육자 모드', () => {
  it('returns null when birthDate is null', () => {
    expect(formatChildAgeLabel(null, TODAY)).toBeNull();
  });

  it('returns null when birthDate is malformed', () => {
    expect(formatChildAgeLabel('not-a-date', TODAY)).toBeNull();
  });

  it('returns "0개월 (1일째)" on the day of birth', () => {
    expect(formatChildAgeLabel('2026-05-12', TODAY)).toBe('0개월 (1일째)');
  });

  it('returns "0개월 (2일째)" the day after birth', () => {
    expect(formatChildAgeLabel('2026-05-11', TODAY)).toBe('0개월 (2일째)');
  });

  it('returns "5개월 (152일째)" example (5 calendar months elapsed)', () => {
    // 2025-12-12 → 2026-05-12 = exactly 5 calendar months, 151 days elapsed.
    // daysSinceBirth = 151, 일째 ordinal = 152.
    expect(formatChildAgeLabel('2025-12-12', TODAY)).toBe('5개월 (152일째)');
  });

  it('returns "12개월 (...)" at exactly 12 months (boundary, still 개월 form)', () => {
    // 2025-05-12 → 2026-05-12 = 12 calendar months.
    expect(formatChildAgeLabel('2025-05-12', TODAY)).toMatch(/^12개월 \(\d+일째\)$/);
  });

  it('switches to "살" at 13 months elapsed (boundary)', () => {
    // 2025-04-12 → 2026-05-12 = 13 calendar months.
    const label = formatChildAgeLabel('2025-04-12', TODAY);
    expect(label).toMatch(/^1살 \(\d+일째\)$/);
  });

  it('shows "2살" at 24 months (2 years)', () => {
    // 2024-05-12 → 2026-05-12 = 24 calendar months → 2 years.
    expect(formatChildAgeLabel('2024-05-12', TODAY)).toMatch(/^2살 \(\d+일째\)$/);
  });

  it('returns null when birthDate is in the future', () => {
    expect(formatChildAgeLabel('2026-05-13', TODAY)).toBeNull();
  });
});
