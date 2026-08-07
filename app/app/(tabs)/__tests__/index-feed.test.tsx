// PRD-009 AC-009-14 — 홈 "다른 엄마들의 기록" 섹션 노출 + "더보기" 라우팅.
//   (구 PRD-007 AC-007-08·09 에서 2026-08-05 이관.)
//
// TC-009-14-A (홈 진입 시 카드 3개 + 마스킹 표시명·아이 현황 가시성, 더보기 →
//   커뮤니티 탭)
// TC-009-14-B (공개 기록 0건 → mock 없이 빈 카드 + `첫 기록을 공개해보세요` CTA)
// AC-009-13 네트워크 오류 행 (호출 실패 → 안내 문구)
//
// 노출 풀·정렬은 서버(ENG-007·008·010)가 정하므로 여기서는 고정 응답으로
// 화면 표면만 검증한다.

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

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: () => undefined,
}));

jest.mock('../../../src/api/notifications', () => ({
  getUnreadCount: jest.fn(() => Promise.resolve(0)),
}));

const FIXTURE = [
  {
    id: 'rec-1',
    authorName: 'cho***3',
    childStatusText: '임신 3주차',
    subjectKind: 'fetus' as const,
    source: 'text' as const,
    questionText: '엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?',
    preview: '두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어. 손이 떨려서…',
    createdAt: '2026-08-07T09:30:00Z',
  },
  {
    id: 'rec-2',
    authorName: 'seo***1',
    childStatusText: '임신 20주차',
    subjectKind: 'fetus' as const,
    source: 'voice' as const,
    questionText: '엄마, 제가 오늘 처음으로 보여준 표정이 뭐였어요?',
    preview: '옹알이를 하다가 갑자기 씨익 웃었는데, 그 순간 시간이 멈춘…',
    createdAt: '2026-08-06T09:30:00Z',
  },
  {
    id: 'rec-3',
    authorName: 'abc***9',
    childStatusText: '임신 30주차',
    subjectKind: 'fetus' as const,
    source: 'text' as const,
    questionText: null,
    preview: '오늘은 아빠가 네 이름을 처음 불러 봤어. 어색해 하면서도 좋아했지.',
    createdAt: '2026-08-05T09:30:00Z',
  },
];

const mockGetTopThreeForHome = jest.fn((_subjectId: string) =>
  Promise.resolve(FIXTURE),
);
jest.mock('../../../src/api/community', () => ({
  getTopThreeForHome: (subjectId: string) => mockGetTopThreeForHome(subjectId),
}));

jest.mock('../../../src/data/dailyQuestions', () => ({
  getDailyQuestionTriplet: jest.fn(() => ['Q1', 'Q2', 'Q3']),
}));

jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', name: '엄마' } }),
}));

jest.mock('../../../src/context/ActiveChildContext', () => ({
  useActiveChild: () => ({
    activeChild: {
      kind: 'fetus' as const,
      ordinal: 1,
      subjectId: 'subj-1',
      dueOrBirthDate: '2026-06-17',
      displayName: '콩이',
      profileImageUrl: null,
    },
    activeIndex: 0,
    canNavigate: false,
    next: jest.fn(),
    prev: jest.fn(),
  }),
}));

import HomeTab from '../index';

async function renderHome() {
  const view = render(<HomeTab />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

beforeEach(() => {
  mockPush.mockClear();
  mockGetTopThreeForHome.mockReset();
  mockGetTopThreeForHome.mockResolvedValue(FIXTURE);
});

describe('HomeTab — 다른 엄마들의 기록 섹션', () => {
  it('TC-009-14-A — renders three cards with masked name, child status and question', async () => {
    const { getByTestId, queryByTestId } = await renderHome();
    expect(getByTestId('home-feed-section')).toBeTruthy();
    for (const e of FIXTURE) {
      const base = `home-feed-entry-${e.id}`;
      expect(getByTestId(base)).toBeTruthy();
      expect(getByTestId(`${base}-alias`).props.children).toBe(e.authorName);
      expect(getByTestId(`${base}-context`).props.children).toBe(
        e.childStatusText,
      );
      if (e.questionText) {
        expect(getByTestId(`${base}-question`).props.children).toBe(
          e.questionText,
        );
      } else {
        // 자유 일기 카드는 질문 줄이 없다.
        expect(queryByTestId(`${base}-question`)).toBeNull();
      }
    }
  });

  it('활성 아이의 subject_id 로 피드를 조회한다', async () => {
    await renderHome();
    expect(mockGetTopThreeForHome).toHaveBeenCalledWith('subj-1');
  });

  it('routes to the community tab when "더보기" is tapped', async () => {
    const { getByTestId } = await renderHome();
    fireEvent.press(getByTestId('home-feed-more'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/community');
  });

  it('TC-009-14-B — 공개 기록이 0건이면 mock 없이 빈 카드 + CTA 를 그린다', async () => {
    mockGetTopThreeForHome.mockResolvedValue([]);
    const { getByTestId, queryByTestId } = await renderHome();
    // 섹션 자체(타이틀·더보기)는 남고 카드 자리만 빈 상태로 바뀐다.
    expect(getByTestId('home-feed-section')).toBeTruthy();
    expect(getByTestId('home-feed-more')).toBeTruthy();
    expect(getByTestId('home-feed-empty-cta').props.children).toBe(
      '첫 기록을 공개해보세요',
    );
    expect(queryByTestId('home-feed-entry-rec-1')).toBeNull();
  });

  it('빈 상태 CTA 를 누르면 기록 작성으로 진입한다', async () => {
    mockGetTopThreeForHome.mockResolvedValue([]);
    const { getByTestId } = await renderHome();
    fireEvent.press(getByTestId('home-feed-empty'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toMatchObject({
      pathname: '/record-text',
    });
  });

  it('AC-009-13 — 조회에 실패하면 0건이 아니라 오류 문구를 그린다', async () => {
    mockGetTopThreeForHome.mockRejectedValue(new Error('boom'));
    const { getByTestId, queryByTestId } = await renderHome();
    expect(getByTestId('home-feed-error')).toBeTruthy();
    expect(queryByTestId('home-feed-empty')).toBeNull();
    expect(queryByTestId('home-feed-entry-rec-1')).toBeNull();
  });
});
