// PRD-007 AC-007-04·05 의 결정적 회전 3-튜플 셀렉터 잠금.
// 같은 날엔 동일한 3개, 다른 날엔 다른 3개, 풀 인덱스가 wrap-around 되는지
// 만 확인한다. 실제 카드 UI 의 회전 동작은 home-tab 테스트가 다룬다.

import {
  DAILY_QUESTIONS,
  DAILY_QUESTION_SLOTS,
  getDailyQuestionTriplet,
} from '../dailyQuestions';

describe('getDailyQuestionTriplet', () => {
  it('returns exactly DAILY_QUESTION_SLOTS questions from the pool', () => {
    const t = getDailyQuestionTriplet(new Date(2026, 0, 1));
    expect(t).toHaveLength(DAILY_QUESTION_SLOTS);
    for (const q of t) {
      expect(DAILY_QUESTIONS).toContain(q);
    }
  });

  it('returns the same 3 questions for the same calendar day', () => {
    const morning = new Date(2026, 4, 12, 8, 0, 0);
    const evening = new Date(2026, 4, 12, 23, 0, 0);
    expect(getDailyQuestionTriplet(morning)).toEqual(
      getDailyQuestionTriplet(evening),
    );
  });

  it('returns a different triplet on a different day', () => {
    const a = getDailyQuestionTriplet(new Date(2026, 4, 12));
    const b = getDailyQuestionTriplet(new Date(2026, 4, 13));
    expect(a).not.toEqual(b);
  });

  it('wraps around the pool index without throwing', () => {
    // 풀 길이를 넘는 dayOfYear 도 modulo 로 안전하게 감싸야 한다.
    const lateYear = new Date(2026, 11, 31);
    const t = getDailyQuestionTriplet(lateYear);
    expect(t).toHaveLength(DAILY_QUESTION_SLOTS);
    for (const q of t) {
      expect(DAILY_QUESTIONS).toContain(q);
    }
  });

  it('wraps around when start index nears the end of the pool', () => {
    // 11번째 인덱스에서 시작하면 [11, 0, 1] 으로 wrap.
    const customPool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'] as const;
    // dayOfYear == 11 인 날: 2026-01-11
    const t = getDailyQuestionTriplet(new Date(2026, 0, 11), customPool);
    expect(t).toEqual(['l', 'a', 'b']);
  });

  it('uses 1st-person mother-talk copy (엄마, 오늘은 제가 …)', () => {
    for (const q of DAILY_QUESTIONS) {
      expect(q.startsWith('엄마, 오늘은 제가')).toBe(true);
    }
  });

  it('returns an empty array for an empty pool', () => {
    expect(getDailyQuestionTriplet(new Date(), [])).toEqual([]);
  });
});
