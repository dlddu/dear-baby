// PRD-007 AC-007-08·09 — 홈 탭의 타인 기록 피드 섹션 노출 + “더보기” 라우팅.
//
// TC-007-08 (홈 진입 시 카드 3개 노출 + 모든 필드 보임)
// TC-007-09-A (셀렉터가 비공개·자기 기록 제외한 결과만 받음 — 본 테스트는
//   고정 mock 으로 셀렉터를 우회하고 홈 표면만 검증한다)

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
    id: 'feed-1',
    authorAlias: 'cho***3',
    childContext: '임신 3주차',
    question: '엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?',
    answer: '두 줄짜리 임테기를 보고 한참을 멍하니 앉아 있었어. 손이 떨려서…',
    heartCount: 50,
    isPublic: true,
    isMine: false,
  },
  {
    id: 'feed-2',
    authorAlias: 'seo***1',
    childContext: '생후 5개월',
    question: '엄마, 제가 오늘 처음으로 보여준 표정이 뭐였어요?',
    answer: '옹알이를 하다가 갑자기 씨익 웃었는데, 그 순간 시간이 멈춘…',
    heartCount: 365,
    isPublic: true,
    isMine: false,
  },
  {
    id: 'feed-3',
    authorAlias: 'abc***9',
    childContext: '4살',
    question: '엄마, 제가 오늘 했던 말 중에 어떤 게 가장 웃겼어요?',
    answer: '"엄마 나는 어른 되면 공룡이 될 거야"라고 말해서 한참을…',
    heartCount: 12,
    isPublic: true,
    isMine: false,
  },
];
jest.mock('../../../src/api/feed', () => ({
  getTopThreeForHome: jest.fn(() => Promise.resolve(FIXTURE)),
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
});

describe('HomeTab — 타인 기록 피드 섹션', () => {
  it('TC-007-08 — renders three OtherEntryCard rows with all required fields', async () => {
    const { getByTestId } = await renderHome();
    expect(getByTestId('home-feed-section')).toBeTruthy();
    for (const e of FIXTURE) {
      const base = `home-feed-entry-${e.id}`;
      expect(getByTestId(base)).toBeTruthy();
      expect(getByTestId(`${base}-alias`).props.children).toBe(e.authorAlias);
      expect(getByTestId(`${base}-context`).props.children).toBe(e.childContext);
      expect(getByTestId(`${base}-question`).props.children).toBe(e.question);
      expect(getByTestId(`${base}-hearts`).props.children).toBe(e.heartCount);
    }
  });

  it('routes to the community tab when "더보기" is tapped', async () => {
    const { getByTestId } = await renderHome();
    fireEvent.press(getByTestId('home-feed-more'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/community');
  });
});
