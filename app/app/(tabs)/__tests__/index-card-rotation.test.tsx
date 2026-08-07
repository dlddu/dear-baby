// PRD-007 AC-007-04·05·06 — 홈 탭의 1인칭 카드 회전·모달 진입 잠금.
//
// TC-007-04: 1인칭 카드(home-question-card) 가 홈 진입 시 노출.
// TC-007-05: 우 화살표를 3번 탭하면 인덱스가 최대 2(=3/3) 까지 올라가고,
//   추가 탭은 무시된다 (UI 비활성 + 부모도 상태를 더 증가시키지 않음).
// TC-007-06-C: 회전된 질문이 record-audio·record-text route param 의
//   `question` 으로 실린다.

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
  // useFocusEffect 의 부수효과(알림 카운트 fetch) 는 본 테스트의 관심사 밖이라
  // no-op 으로 둔다 — 비동기 setState 가 act 경고를 만들지 않게 한다.
  useFocusEffect: () => undefined,
}));

jest.mock('../../../src/api/notifications', () => ({
  getUnreadCount: jest.fn(() => Promise.resolve(0)),
}));

// 본 테스트는 피드 영역이 관심사 밖 — 빈 배열을 돌려 카드가 렌더되지 않게
// 한다 (act 경고 방지 + 회전·CTA 단정의 testID 충돌 차단).
jest.mock('../../../src/api/community', () => ({
  getTopThreeForHome: jest.fn(() => Promise.resolve([])),
}));

// 결정적 3개. 테스트는 인덱스 0/1/2 의 텍스트를 비교하므로 풀의 실제 카피와
// 무관하게 셀렉터가 안정적인 3개를 돌려준다고 가정한다.
const TEST_TRIPLET = ['질문 1', '질문 2', '질문 3'] as const;
jest.mock('../../../src/data/dailyQuestions', () => ({
  getDailyQuestionTriplet: jest.fn(() => TEST_TRIPLET),
}));

jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', name: '엄마' } }),
}));

const mockActiveChild = {
  kind: 'fetus' as const,
  ordinal: 1,
  dueOrBirthDate: '2026-06-17',
  displayName: '콩이',
  profileImageUrl: null,
};
jest.mock('../../../src/context/ActiveChildContext', () => ({
  useActiveChild: () => ({
    activeChild: mockActiveChild,
    activeIndex: 0,
    canNavigate: false,
    next: jest.fn(),
    prev: jest.fn(),
  }),
}));

import HomeTab from '../index';

beforeEach(() => {
  mockPush.mockClear();
});

// 피드 useEffect 가 Promise.resolve([]) 로 setState 를 호출하기 때문에 마운트
// 직후 한 번의 microtask 플러시가 필요하다. flushFeedEffect 를 거치지 않으면
// act 경고가 콘솔로 새어 나온다 — 실제 단정에는 영향이 없다.
async function renderHome() {
  const view = render(<HomeTab />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

describe('HomeTab — 1인칭 카드 회전 + 모달 진입', () => {
  describe('TC-007-04', () => {
    it('renders the home-question-card on home entry', async () => {
      const { getByTestId } = await renderHome();
      expect(getByTestId('home-question-card')).toBeTruthy();
      expect(getByTestId('home-question-card-question').props.children).toBe(
        '질문 1',
      );
      expect(getByTestId('home-question-card-index').props.children).toBe('1/3');
    });
  });

  describe('TC-007-05', () => {
    it('caps rotation at 3 — 3번째 탭 이후 우 화살표가 비활성, 추가 탭은 무시', async () => {
      const { getByTestId } = await renderHome();
      const next = getByTestId('home-question-card-next');

      fireEvent.press(next);
      expect(getByTestId('home-question-card-index').props.children).toBe('2/3');
      expect(getByTestId('home-question-card-question').props.children).toBe(
        '질문 2',
      );

      fireEvent.press(next);
      expect(getByTestId('home-question-card-index').props.children).toBe('3/3');
      expect(getByTestId('home-question-card-question').props.children).toBe(
        '질문 3',
      );

      // 3/3 에서 다시 탭해도 인덱스는 더 증가하지 않는다.
      const stillNext = getByTestId('home-question-card-next');
      expect(stillNext.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(stillNext);
      expect(getByTestId('home-question-card-index').props.children).toBe('3/3');
      expect(getByTestId('home-question-card-question').props.children).toBe(
        '질문 3',
      );
    });
  });

  describe('TC-007-06-C — 회전된 질문이 route param 으로 실림', () => {
    it('passes the current rotated question to the voice modal', async () => {
      const { getByTestId } = await renderHome();
      fireEvent.press(getByTestId('home-question-card-next'));
      fireEvent.press(getByTestId('home-voice-cta'));
      expect(mockPush).toHaveBeenCalledTimes(1);
      const call = mockPush.mock.calls[0][0];
      expect(call.pathname).toBe('/record-audio');
      expect(call.params.question).toBe('질문 2');
    });

    it('passes the current rotated question to the text modal', async () => {
      const { getByTestId } = await renderHome();
      fireEvent.press(getByTestId('home-question-card-next'));
      fireEvent.press(getByTestId('home-question-card-next'));
      fireEvent.press(getByTestId('home-text-cta'));
      expect(mockPush).toHaveBeenCalledTimes(1);
      const call = mockPush.mock.calls[0][0];
      expect(call.pathname).toBe('/record-text');
      expect(call.params.question).toBe('질문 3');
    });
  });
});
