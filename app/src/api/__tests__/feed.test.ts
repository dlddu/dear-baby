// PRD-007 AC-007-08·09 — 타인 기록 피드 셀렉터의 필터·정렬·컷 잠금.
// TC-007-08 (상위 3개 + 답변 50자 컷), 09-A (비공개·자기 기록 제외),
// 09-B (♥ 내림차순) 를 단위 레벨에서 고정한다.

import {
  FEED_ANSWER_SNIPPET_LIMIT,
  FEED_HOME_LIMIT,
  type FeedEntry,
  getTopThreeForHome,
  truncateAnswer,
} from '../feed';

function entry(overrides: Partial<FeedEntry>): FeedEntry {
  return {
    id: 'x',
    authorAlias: 'aaa***0',
    childContext: '임신 10주차',
    question: '엄마, 오늘은 어땠어요?',
    answer: '오늘은 너에게 처음 편지를 써 봤어.',
    heartCount: 0,
    isPublic: true,
    isMine: false,
    ...overrides,
  };
}

describe('truncateAnswer', () => {
  it('returns text as-is when shorter than the limit', () => {
    expect(truncateAnswer('짧은 글')).toBe('짧은 글');
  });

  it('returns text as-is when exactly the limit', () => {
    const exact = 'a'.repeat(FEED_ANSWER_SNIPPET_LIMIT);
    expect(truncateAnswer(exact)).toBe(exact);
  });

  it('truncates with an ellipsis marker when over the limit', () => {
    const over = 'a'.repeat(FEED_ANSWER_SNIPPET_LIMIT + 5);
    const out = truncateAnswer(over);
    expect(out).toHaveLength(FEED_ANSWER_SNIPPET_LIMIT + 1);
    expect(out.endsWith('…')).toBe(true);
  });

  it('respects a custom limit', () => {
    expect(truncateAnswer('abcdef', 3)).toBe('abc…');
  });
});

describe('getTopThreeForHome', () => {
  describe('TC-007-08 — 상위 3개 + 50자 컷', () => {
    it('returns at most FEED_HOME_LIMIT entries', async () => {
      const pool: FeedEntry[] = [
        entry({ id: '1', heartCount: 10 }),
        entry({ id: '2', heartCount: 20 }),
        entry({ id: '3', heartCount: 30 }),
        entry({ id: '4', heartCount: 40 }),
        entry({ id: '5', heartCount: 50 }),
      ];
      const result = await getTopThreeForHome(pool);
      expect(result).toHaveLength(FEED_HOME_LIMIT);
    });

    it('returns the default mock pool (3 entries) when called without args', async () => {
      const result = await getTopThreeForHome();
      expect(result).toHaveLength(FEED_HOME_LIMIT);
      for (const e of result) {
        expect(e.isPublic).toBe(true);
        expect(e.isMine).toBe(false);
      }
    });

    it('truncates each answer to FEED_ANSWER_SNIPPET_LIMIT with an ellipsis', async () => {
      const longAnswer = '가'.repeat(FEED_ANSWER_SNIPPET_LIMIT + 20);
      const pool: FeedEntry[] = [entry({ id: '1', answer: longAnswer })];
      const [first] = await getTopThreeForHome(pool);
      expect(first.answer).toHaveLength(FEED_ANSWER_SNIPPET_LIMIT + 1);
      expect(first.answer.endsWith('…')).toBe(true);
    });

    it('leaves short answers untouched', async () => {
      const short = '짧은 답변.';
      const pool: FeedEntry[] = [entry({ id: '1', answer: short })];
      const [first] = await getTopThreeForHome(pool);
      expect(first.answer).toBe(short);
    });

    it('returns fewer entries when the pool is small', async () => {
      const pool: FeedEntry[] = [
        entry({ id: '1', heartCount: 1 }),
        entry({ id: '2', heartCount: 2 }),
      ];
      const result = await getTopThreeForHome(pool);
      expect(result).toHaveLength(2);
    });
  });

  describe('TC-007-09-A — 비공개·자기 기록 제외', () => {
    it('omits private entries even if they have the highest hearts', async () => {
      const pool: FeedEntry[] = [
        entry({ id: 'pub', heartCount: 1 }),
        entry({ id: 'priv', heartCount: 999, isPublic: false }),
      ];
      const result = await getTopThreeForHome(pool);
      const ids = result.map((e) => e.id);
      expect(ids).toContain('pub');
      expect(ids).not.toContain('priv');
    });

    it('omits the current user own entries (isMine)', async () => {
      const pool: FeedEntry[] = [
        entry({ id: 'pub', heartCount: 1 }),
        entry({ id: 'mine', heartCount: 999, isMine: true }),
      ];
      const result = await getTopThreeForHome(pool);
      const ids = result.map((e) => e.id);
      expect(ids).toContain('pub');
      expect(ids).not.toContain('mine');
    });

    it('omits both private and own entries together', async () => {
      const pool: FeedEntry[] = [
        entry({ id: 'a', heartCount: 1 }),
        entry({ id: 'b', heartCount: 2 }),
        entry({ id: 'c', heartCount: 3 }),
        entry({ id: 'mine', heartCount: 999, isMine: true }),
        entry({ id: 'priv', heartCount: 998, isPublic: false }),
      ];
      const result = await getTopThreeForHome(pool);
      expect(result.map((e) => e.id)).toEqual(['c', 'b', 'a']);
    });
  });

  describe('TC-007-09-B — ♥ 내림차순', () => {
    it('orders entries by heartCount descending', async () => {
      const pool: FeedEntry[] = [
        entry({ id: 'low', heartCount: 5 }),
        entry({ id: 'high', heartCount: 500 }),
        entry({ id: 'mid', heartCount: 50 }),
      ];
      const result = await getTopThreeForHome(pool);
      expect(result.map((e) => e.heartCount)).toEqual([500, 50, 5]);
    });

    it('uses a stable sort on ties — earlier pool entries come first', async () => {
      const pool: FeedEntry[] = [
        entry({ id: 'first', heartCount: 10 }),
        entry({ id: 'second', heartCount: 10 }),
        entry({ id: 'third', heartCount: 10 }),
      ];
      const result = await getTopThreeForHome(pool);
      expect(result.map((e) => e.id)).toEqual(['first', 'second', 'third']);
    });
  });
});
