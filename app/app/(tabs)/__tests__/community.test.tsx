// PRD-009 커뮤니티 탭 메인 화면 — M-43 재작업분.
//
// 이 슬라이스가 완결한다고 주장하는 AC 세 개를 화면 레벨에서 잠근다:
//   - AC-009-03: 상단 상태값 표시 · 활성 아이 전환 시 갱신 · 수동 시기 필터
//     미제공(= stage pill 이 눌리지 않는다).
//   - AC-009-06: 전체/질문답변/자유일기 3종 · 기본값 전체 · 선택이 서버
//     요청의 `type` 으로 나간다(클라이언트가 페이지 안에서 거르지 않는다).
//   - AC-009-13(커뮤니티 피드 3행): 0건 · 필터 결과 0건 · 네트워크 오류.
//
// 더해 M-43 이 요구하는 화면 골격(①헤더 ②유사 시기 ④필터 ⑤피드)과, ③ 오늘의
// 질문 카드가 **의도적으로 없다는 것**을 함께 잠근다 — 나중에 누가 자리만
// 채워 넣으면 이탈 기록과 코드가 어긋나기 때문이다.
//
// 노출 풀·정렬은 서버(ENG-007·008·010) 몫이라 고정 응답으로 화면 표면만 본다.

import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = ({ children, ...rest }: any) =>
    React.createElement(View, rest, children);
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 320, height: 640 }),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 320, height: 640 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  };
});

const mockGetCommunityFeed = jest.fn();
jest.mock('../../../src/api/community', () => ({
  DEFAULT_FEED_TYPE: 'all',
  getCommunityFeed: (options: unknown) => mockGetCommunityFeed(options),
}));

const mockGetUnreadCount = jest.fn();
jest.mock('../../../src/api/notifications', () => ({
  getUnreadCount: () => mockGetUnreadCount(),
}));

// 활성 아이는 테스트마다 바꿔야 하므로(AC-009-03 전환 갱신) 가변 홀더를 둔다.
let mockActiveChild: {
  kind: 'fetus' | 'child';
  ordinal: number;
  subjectId: string;
  dueOrBirthDate: string | null;
  displayName: string;
  profileImageUrl: string | null;
} | null = null;

jest.mock('../../../src/context/ActiveChildContext', () => ({
  useActiveChild: () => ({
    activeChild: mockActiveChild,
    activeIndex: 0,
    canNavigate: false,
    next: jest.fn(),
    prev: jest.fn(),
  }),
}));

import CommunityTab from '../community';

const FETUS = {
  kind: 'fetus' as const,
  ordinal: 1,
  subjectId: 'subj-fetus',
  // 테스트가 오늘 날짜에 의존하지 않도록 renderTab 실행 시점을 기준으로
  // 예정일을 계산한다 (D-140 → 임신 20주차).
  dueOrBirthDate: null as string | null,
  displayName: '콩이',
  profileImageUrl: null,
};

const CHILD = {
  kind: 'child' as const,
  ordinal: 1,
  subjectId: 'subj-child',
  dueOrBirthDate: null as string | null,
  displayName: '햇살이',
  profileImageUrl: null,
};

function dayOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function item(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    authorName: 'seo***1',
    childStatusText: '임신 20주차',
    subjectKind: 'fetus' as const,
    source: 'text' as const,
    questionText: '엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?',
    preview: '두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어…',
    createdAt: '2026-08-07T09:30:00Z',
    ...overrides,
  };
}

function page(items: unknown[], nextCursor = '') {
  return { items, nextCursor };
}

async function renderTab() {
  const view = render(<CommunityTab />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

beforeEach(() => {
  mockGetCommunityFeed.mockReset();
  mockGetCommunityFeed.mockResolvedValue(page([item('r-1'), item('r-2')]));
  mockGetUnreadCount.mockReset();
  mockGetUnreadCount.mockResolvedValue(1);
  mockActiveChild = { ...FETUS, dueOrBirthDate: dayOffset(140) };
});

// M-43 의 화면 구조를 코드가 실제로 그리는지 — 요소 유무와 순서.
describe('M-43 — 화면 골격', () => {
  it('keeps the community-tab testID the 5탭 e2e flow asserts', async () => {
    const { getByTestId } = await renderTab();
    expect(getByTestId('community-tab')).toBeTruthy();
  });

  it('① 헤더는 가운데 "커뮤니티" 와 알림 종을 갖는다', async () => {
    const { getByTestId, getByText } = await renderTab();
    expect(getByTestId('community-header')).toBeTruthy();
    expect(getByText('커뮤니티')).toBeTruthy();
    expect(getByTestId('community-header-bell')).toBeTruthy();
    // 미읽음이 있으면 coral dot 이 뜬다 (M-43 의 `bg-coral` 점).
    expect(getByTestId('community-header-unread-dot')).toBeTruthy();
  });

  it('미읽음이 0이면 헤더 dot 이 사라진다', async () => {
    mockGetUnreadCount.mockResolvedValue(0);
    const { queryByTestId } = await renderTab();
    expect(queryByTestId('community-header-unread-dot')).toBeNull();
  });

  it('② 유사 시기 영역의 카피는 목업 문자열 그대로다', async () => {
    const { getByText } = await renderTab();
    expect(getByText('나와 비슷한 엄마들의 기록')).toBeTruthy();
  });

  // ③ 오늘의 질문 카드는 이번 슬라이스 이탈 1 — AC-009-04 의 CTA 목적지가
  // 미구현·목업 미작성이라 일부러 그리지 않는다. 카피가 새어 들어오면 그건
  // 갈 곳 없는 CTA 가 생겼다는 뜻이므로 여기서 막는다.
  it('③ 오늘의 질문 카드는 그리지 않는다 (이탈 1 — 목적지 미구현)', async () => {
    const { queryByText } = await renderTab();
    expect(queryByText('오늘의 질문')).toBeNull();
    expect(queryByText('다른 엄마들의 답변 보기')).toBeNull();
  });

  it('⑤ 피드 카드가 마스킹 표시명과 아이 현황을 그린다 (AC-009-02)', async () => {
    const { getByTestId } = await renderTab();
    expect(getByTestId('community-feed-entry-r-1')).toBeTruthy();
    expect(getByTestId('community-feed-entry-r-1-alias').props.children).toBe(
      'seo***1',
    );
    expect(getByTestId('community-feed-entry-r-1-stage').props.children).toBe(
      '임신 20주차',
    );
  });
});

describe('AC-009-03 — 상단 상태값', () => {
  it('임산부는 임신 N주차', async () => {
    const { getByTestId } = await renderTab();
    expect(getByTestId('community-stage-pill-label').props.children).toBe(
      '임신 20주차',
    );
  });

  it('양육자는 생후 N개월', async () => {
    mockActiveChild = { ...CHILD, dueOrBirthDate: dayOffset(-160) };
    const { getByTestId } = await renderTab();
    expect(getByTestId('community-stage-pill-label').props.children).toBe(
      '생후 5개월',
    );
  });

  it('활성 아이가 바뀌면 그 아이의 subject 로 피드를 다시 받는다', async () => {
    const { rerender } = await renderTab();
    expect(mockGetCommunityFeed).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'subj-fetus' }),
    );

    mockActiveChild = { ...CHILD, dueOrBirthDate: dayOffset(-160) };
    await act(async () => {
      rerender(<CommunityTab />);
      await Promise.resolve();
    });
    expect(mockGetCommunityFeed).toHaveBeenLastCalledWith(
      expect.objectContaining({ subjectId: 'subj-child' }),
    );
  });

  // "1차 런치에서는 사용자가 직접 필터를 변경하는 기능을 제공하지 않는다."
  // M-43 도 이 pill 을 `<div>` 로 그렸다 — 누를 수 있게 만들면 AC 위반이다.
  it('stage pill 은 표시 전용이다 — 버튼 역할도 onPress 도 없다', async () => {
    const { getByTestId } = await renderTab();
    const pill = getByTestId('community-stage-pill');
    expect(pill.props.accessibilityRole).toBeUndefined();
    expect(pill.props.onStartShouldSetResponder).toBeUndefined();
  });

  it('사용자가 시기를 직접 고르는 필터는 없다 — 타입 칩 3개가 전부다', async () => {
    const { getByTestId } = await renderTab();
    // 라벨도 AC-009-06 표 그대로 — 시기(주차/개월) 칩은 하나도 없다.
    for (const [value, label] of [
      ['all', '전체'],
      ['question', '질문답변'],
      ['diary', '자유일기'],
    ] as const) {
      expect(
        getByTestId(`community-filter-${value}`).props.accessibilityLabel,
      ).toBe(label);
    }
  });
});

describe('AC-009-06 — 콘텐츠 타입 필터', () => {
  it('기본 선택값은 전체이고 첫 요청은 type=all 로 나간다', async () => {
    const { getByTestId } = await renderTab();
    expect(mockGetCommunityFeed).toHaveBeenCalledTimes(1);
    expect(mockGetCommunityFeed).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'all' }),
    );
    // 선택 상태도 `전체` 하나뿐이어야 한다.
    expect(
      getByTestId('community-filter-all').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      getByTestId('community-filter-question').props.accessibilityState
        .selected,
    ).toBe(false);
    expect(
      getByTestId('community-filter-diary').props.accessibilityState.selected,
    ).toBe(false);
  });

  it('칩을 고르면 그 타입으로 서버에 다시 요청한다', async () => {
    const { getByTestId } = await renderTab();
    for (const type of ['question', 'diary'] as const) {
      await act(async () => {
        fireEvent.press(getByTestId(`community-filter-${type}`));
        await Promise.resolve();
      });
      expect(mockGetCommunityFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ type, subjectId: 'subj-fetus' }),
      );
    }
  });

  it('필터를 바꾸면 커서를 버리고 첫 페이지부터 받는다', async () => {
    mockGetCommunityFeed.mockResolvedValue(page([item('r-1')], 'cursor-1'));
    const { getByTestId } = await renderTab();
    await act(async () => {
      fireEvent.press(getByTestId('community-filter-diary'));
      await Promise.resolve();
    });
    expect(mockGetCommunityFeed).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ cursor: expect.anything() }),
    );
  });
});

// 문구는 AC-009-13 표에서 그대로 복사한 것이라, testID 존재가 아니라
// **렌더된 문자열**을 대조한다 — 그러지 않으면 카피가 바뀌어도 테스트가
// 통과해 AC 를 잠그지 못한다.
describe('AC-009-13 — 빈 상태 / 예외 상태', () => {
  it('공개 기록이 0건이면 "아직 공개된 기록이 없어요"', async () => {
    mockGetCommunityFeed.mockResolvedValue(page([]));
    const { getByTestId, getByText, queryByTestId } = await renderTab();
    expect(getByTestId('community-feed-empty')).toBeTruthy();
    expect(getByText('아직 공개된 기록이 없어요')).toBeTruthy();
    expect(queryByTestId('community-feed-empty-filtered')).toBeNull();
  });

  it('필터 결과가 0건이면 "해당 조건의 기록이 아직 없어요"', async () => {
    const { getByTestId, getByText, queryByTestId } = await renderTab();
    mockGetCommunityFeed.mockResolvedValue(page([]));
    await act(async () => {
      fireEvent.press(getByTestId('community-filter-diary'));
      await Promise.resolve();
    });
    expect(getByTestId('community-feed-empty-filtered')).toBeTruthy();
    expect(getByText('해당 조건의 기록이 아직 없어요')).toBeTruthy();
    expect(queryByTestId('community-feed-empty')).toBeNull();
  });

  it('호출이 실패하면 "기록을 불러오지 못했어요. 다시 시도해주세요"', async () => {
    mockGetCommunityFeed.mockRejectedValue(new Error('boom'));
    const { getByTestId, getByText, queryByTestId } = await renderTab();
    expect(getByTestId('community-feed-error')).toBeTruthy();
    expect(getByText('기록을 불러오지 못했어요. 다시 시도해주세요')).toBeTruthy();
    // 실패를 0건으로 그리면 사용자에게 거짓말이 된다.
    expect(queryByTestId('community-feed-empty')).toBeNull();
  });
});

describe('ENG-009 — 커서 추가 로드', () => {
  it('목록 끝에 닿으면 커서로 다음 페이지를 이어 붙인다', async () => {
    mockGetCommunityFeed.mockResolvedValueOnce(page([item('r-1')], 'cur-1'));
    const { getByTestId } = await renderTab();

    mockGetCommunityFeed.mockResolvedValueOnce(page([item('r-2')], ''));
    await act(async () => {
      getByTestId('community-feed-list').props.onEndReached();
      await Promise.resolve();
    });
    expect(mockGetCommunityFeed).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cur-1' }),
    );
    expect(getByTestId('community-feed-entry-r-1')).toBeTruthy();
    expect(getByTestId('community-feed-entry-r-2')).toBeTruthy();
  });

  it('마지막 페이지(커서 없음)에서는 추가 요청을 하지 않는다', async () => {
    mockGetCommunityFeed.mockResolvedValue(page([item('r-1')], ''));
    const { getByTestId } = await renderTab();
    expect(mockGetCommunityFeed).toHaveBeenCalledTimes(1);
    await act(async () => {
      getByTestId('community-feed-list').props.onEndReached();
      await Promise.resolve();
    });
    expect(mockGetCommunityFeed).toHaveBeenCalledTimes(1);
  });
});
