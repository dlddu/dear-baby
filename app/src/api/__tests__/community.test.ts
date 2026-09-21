// PRD-009 커뮤니티 피드 클라이언트 — 서버 계약 매핑과 오류 전파.
//
// 정렬·필터·마스킹·50자 컷은 서버 몫이라 여기서 검증하지 않는다 (백엔드
// community_test.go 가 잠근다). 이 테스트가 잠그는 것은 "서버가 준 것을
// 그대로, 빠짐없이, 가공 없이 카드 타입으로 옮기는가" 하나다.

import {
  DEFAULT_FEED_TYPE,
  HOME_FEED_LIMIT,
  getCommunityFeed,
  getTopThreeForHome,
} from '../community';

const mockApiFetch = jest.fn();
jest.mock('../client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function rawItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    author_name: 'seo***1',
    child_status_text: '임신 20주차',
    subject_kind: 'fetus',
    source: 'text',
    question_text: '엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?',
    preview: '두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어…',
    created_at: '2026-08-07T09:30:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe('getCommunityFeed', () => {
  it('subject_id 를 쿼리에 실어 호출한다', async () => {
    mockApiFetch.mockResolvedValue(okResponse({ items: [], next_cursor: '' }));
    await getCommunityFeed({ subjectId: 'subj-1', limit: 3 });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const [path] = mockApiFetch.mock.calls[0];
    expect(path).toContain('/community/feed?');
    expect(path).toContain('subject_id=subj-1');
    expect(path).toContain('limit=3');
  });

  it('커서가 있으면 함께 싣고, 없으면 싣지 않는다', async () => {
    mockApiFetch.mockResolvedValue(okResponse({ items: [], next_cursor: '' }));
    await getCommunityFeed({ subjectId: 'subj-1' });
    expect(mockApiFetch.mock.calls[0][0]).not.toContain('cursor=');
    await getCommunityFeed({ subjectId: 'subj-1', cursor: '2026-08-01 00:00:00' });
    expect(mockApiFetch.mock.calls[1][0]).toContain('cursor=');
  });

  it('snake_case 응답을 카드 타입으로 옮긴다', async () => {
    mockApiFetch.mockResolvedValue(
      okResponse({ items: [rawItem('rec-1')], next_cursor: 'cur-1' }),
    );
    const page = await getCommunityFeed({ subjectId: 'subj-1' });
    expect(page.nextCursor).toBe('cur-1');
    expect(page.items).toEqual([
      {
        id: 'rec-1',
        authorName: 'seo***1',
        childStatusText: '임신 20주차',
        subjectKind: 'fetus',
        source: 'text',
        questionText: '엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?',
        preview: '두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어…',
        createdAt: '2026-08-07T09:30:00Z',
      },
    ]);
  });

  it('자유 일기(question_text=null)와 현황 미산출(빈 문자열)을 그대로 통과시킨다', async () => {
    mockApiFetch.mockResolvedValue(
      okResponse({
        items: [rawItem('rec-1', { question_text: null, child_status_text: '' })],
        next_cursor: '',
      }),
    );
    const page = await getCommunityFeed({ subjectId: 'subj-1' });
    expect(page.items[0].questionText).toBeNull();
    expect(page.items[0].childStatusText).toBe('');
  });

  it('items 가 null 이면 빈 배열로 정규화한다', async () => {
    mockApiFetch.mockResolvedValue(okResponse({ items: null, next_cursor: '' }));
    const page = await getCommunityFeed({ subjectId: 'subj-1' });
    expect(page.items).toEqual([]);
  });

  it('subjectId 없이 호출하면 네트워크를 때리지 않고 실패한다', async () => {
    await expect(getCommunityFeed({ subjectId: '' })).rejects.toThrow(
      /subjectId/,
    );
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('비200 응답은 throw 한다 (호출자가 오류 상태를 그린다)', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(getCommunityFeed({ subjectId: 'subj-1' })).rejects.toThrow(
      /500/,
    );
  });

  it('네트워크 예외는 그대로 전파한다', async () => {
    mockApiFetch.mockRejectedValue(new TypeError('Network request failed'));
    await expect(getCommunityFeed({ subjectId: 'subj-1' })).rejects.toThrow(
      /Network request failed/,
    );
  });
});

describe('getTopThreeForHome', () => {
  it('limit 3 으로 첫 페이지를 받아 그대로 돌려준다 (정렬은 서버 몫)', async () => {
    mockApiFetch.mockResolvedValue(
      okResponse({
        items: [rawItem('rec-1'), rawItem('rec-2'), rawItem('rec-3')],
        next_cursor: 'cur-1',
      }),
    );
    const items = await getTopThreeForHome('subj-1');
    expect(mockApiFetch.mock.calls[0][0]).toContain(`limit=${HOME_FEED_LIMIT}`);
    expect(items.map((i) => i.id)).toEqual(['rec-1', 'rec-2', 'rec-3']);
  });

  it('서버가 3건보다 많이 주더라도 3건으로 자른다', async () => {
    mockApiFetch.mockResolvedValue(
      okResponse({
        items: [rawItem('a'), rawItem('b'), rawItem('c'), rawItem('d')],
        next_cursor: '',
      }),
    );
    const items = await getTopThreeForHome('subj-1');
    expect(items).toHaveLength(HOME_FEED_LIMIT);
  });

  it('공개 기록이 0건이면 빈 배열 (홈이 빈 상태를 그린다)', async () => {
    mockApiFetch.mockResolvedValue(okResponse({ items: [], next_cursor: '' }));
    await expect(getTopThreeForHome('subj-1')).resolves.toEqual([]);
  });
});

// AC-009-06 콘텐츠 타입 필터 — 값은 서버 enum 그대로 전달된다. 클라이언트는
// 어떤 기록이 어느 타입인지 판정하지 않으므로, 여기서 잠그는 것은 "정확히
// 그 문자열을 실어 보내는가" 와 "기본값일 때는 아무것도 싣지 않는가" 뿐이다.
describe('getCommunityFeed — type 필터 (AC-009-06)', () => {
  it('type 을 쿼리에 그대로 싣는다', async () => {
    for (const type of ['question', 'diary'] as const) {
      mockApiFetch.mockReset();
      mockApiFetch.mockResolvedValue(okResponse({ items: [], next_cursor: '' }));
      await getCommunityFeed({ subjectId: 'subj-1', type });
      const [path] = mockApiFetch.mock.calls[0];
      expect(path).toContain(`type=${type}`);
    }
  });

  it('기본값(전체)이면 type 을 싣지 않는다 — 홈 요청이 그대로 유지된다', async () => {
    mockApiFetch.mockResolvedValue(okResponse({ items: [], next_cursor: '' }));
    await getCommunityFeed({ subjectId: 'subj-1', type: DEFAULT_FEED_TYPE });
    const [withDefault] = mockApiFetch.mock.calls[0];
    expect(withDefault).not.toContain('type=');

    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue(okResponse({ items: [], next_cursor: '' }));
    await getCommunityFeed({ subjectId: 'subj-1' });
    const [omitted] = mockApiFetch.mock.calls[0];
    expect(omitted).toBe(withDefault);
  });
});
