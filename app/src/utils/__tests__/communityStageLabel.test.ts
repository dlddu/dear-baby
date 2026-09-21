// PRD-009 AC-009-03 — 상단 상태값 문구.
//
// 이 테스트가 잠그는 것 두 가지:
//   1) AC-009-03 표의 문구 형태("임신 20주차" / "생후 5개월") 자체.
//   2) 백엔드 `records.childStatusText` 와 **같은 답**을 낸다는 것 — 같은
//      화면에서 내 상태값과 카드의 아이 현황이 다른 어휘를 쓰면 안 된다.
//      아래 경계값은 backend/internal/records/community_test.go 의
//      TestChildStatusText 와 짝을 이룬다.
//   3) 홈 헤더 포맷터와의 분기 — 출산 100일 이내에도 D-day 가 아니라
//      주차로 그린다(홈은 AC-007-01 에 따라 D-day 다).

import { formatPregnancyLabel } from '../childLabel';
import { formatCommunityStageLabel } from '../communityStageLabel';

// 기준일 고정 — 상대 날짜 계산이라 '오늘'을 주입한다.
const TODAY = new Date(2026, 7, 7); // 2026-08-07 (local)

function dayOffset(days: number): string {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

describe('formatCommunityStageLabel — 임신 (AC-009-03)', () => {
  it('always renders 임신 N주차 (ENG-001: 280일 만삭, floor(daysPregnant/7))', () => {
    // 예정일까지 140일 남음 → daysPregnant 140 → 20주차.
    expect(formatCommunityStageLabel('fetus', dayOffset(140), TODAY)).toBe(
      '임신 20주차',
    );
    // 예정일 당일 → 280일 → 40주차.
    expect(formatCommunityStageLabel('fetus', dayOffset(0), TODAY)).toBe(
      '임신 40주차',
    );
  });

  it('출산 100일 이내에도 D-day 가 아니라 주차로 그린다 (홈 헤더와의 분기)', () => {
    const due = dayOffset(36);
    // 홈(AC-007-01)은 D-36. 커뮤니티(AC-009-03)는 주차여야 한다.
    expect(formatPregnancyLabel(due, TODAY)).toBe('D-36');
    expect(formatCommunityStageLabel('fetus', due, TODAY)).toBe('임신 34주차');
  });

  it('경계 밖이면 null — 없는 값을 지어내지 않는다', () => {
    // 과거 5주 초과(백엔드 pregnancyPastCapDays)
    expect(formatCommunityStageLabel('fetus', dayOffset(-36), TODAY)).toBeNull();
    // 미래 45주 초과(백엔드 pregnancyFutureCapDays)
    expect(formatCommunityStageLabel('fetus', dayOffset(7 * 45 + 1), TODAY)).toBeNull();
    expect(formatCommunityStageLabel('fetus', null, TODAY)).toBeNull();
  });

  it('예정일이 지났어도 백엔드와 같은 경계(5주)까지는 주차를 낸다', () => {
    // 홈 포맷터는 daysUntilDue < 0 을 통째로 null 로 막지만, 카드에 찍히는
    // 백엔드 규칙은 -5주까지 살아 있다. 두 표면이 어긋나지 않도록 맞춘다.
    expect(formatPregnancyLabel(dayOffset(-7), TODAY)).toBeNull();
    expect(formatCommunityStageLabel('fetus', dayOffset(-7), TODAY)).toBe(
      '임신 41주차',
    );
  });
});

describe('formatCommunityStageLabel — 양육 (AC-009-03)', () => {
  it('13개월 미만은 생후 N개월', () => {
    expect(formatCommunityStageLabel('child', '2026-03-07', TODAY)).toBe(
      '생후 5개월',
    );
    expect(formatCommunityStageLabel('child', '2026-08-07', TODAY)).toBe(
      '생후 0개월',
    );
    // 12개월 = 아직 개월 표기 (경계 바로 아래)
    expect(formatCommunityStageLabel('child', '2025-08-07', TODAY)).toBe(
      '생후 12개월',
    );
  });

  it('13개월부터 N살', () => {
    expect(formatCommunityStageLabel('child', '2025-07-07', TODAY)).toBe('1살');
    expect(formatCommunityStageLabel('child', '2024-08-07', TODAY)).toBe('2살');
  });

  it('미래 생일은 null', () => {
    expect(formatCommunityStageLabel('child', dayOffset(30), TODAY)).toBeNull();
  });
});
