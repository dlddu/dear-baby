// PRD-007 AC-007-07 — 홈 탭의 책 진행도 + 자서전 탭 라우팅.
//
// TC-007-07-A: 활성 아이의 mock 카운트가 < 50 이면 진행 텍스트가 표시된다.
// TC-007-07-B: mock 카운트가 50 이면 "책 만들기" CTA 가 표시되고, 탭하면
//   자서전 탭(`/(tabs)/memoir`) 으로 router.push 가 호출된다.
// TC-007-07-C: 다자녀 — 활성 아이 ordinal 이 바뀌면 진행도가 독립적으로
//   재페치된다 (mock 이 ordinal 별 다른 값을 돌려주는지).
//
// recordsCount mock 은 `getCountByActiveChild` 의 결정적 fallback 을 그대로
// 사용한다 — 단위테스트 레벨에서는 백엔드 교체 시 같은 시그니처를 유지하는
// 것이 핵심이므로 export 를 직접 mock 하지 않고 fallback 동작을 검증한다.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

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

const TEST_TRIPLET = ['질문 1', '질문 2', '질문 3'] as const;
jest.mock('../../../src/data/dailyQuestions', () => ({
  getDailyQuestionTriplet: jest.fn(() => TEST_TRIPLET),
}));

jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', name: '엄마' } }),
}));

// 활성 아이 mock — 테스트가 직접 교체할 수 있도록 변수로 노출.
const mockActiveChildRef: { current: any } = {
  current: {
    kind: 'fetus' as const,
    ordinal: 1,
    dueOrBirthDate: '2026-06-17',
    displayName: '콩이',
    profileImageUrl: null,
  },
};
jest.mock('../../../src/context/ActiveChildContext', () => ({
  useActiveChild: () => ({
    activeChild: mockActiveChildRef.current,
    activeIndex: 0,
    canNavigate: true,
    next: jest.fn(),
    prev: jest.fn(),
  }),
}));

import HomeTab from '../index';

beforeEach(() => {
  mockPush.mockClear();
  mockActiveChildRef.current = {
    kind: 'fetus' as const,
    ordinal: 1,
    dueOrBirthDate: '2026-06-17',
    displayName: '콩이',
    profileImageUrl: null,
  };
});

describe('HomeTab — 책 진행도 (AC-007-07)', () => {
  describe('TC-007-07-A — n < 50: 진행 텍스트 표시', () => {
    it('renders progress copy + fraction for a 태아 ordinal=1 (fallback=12)', async () => {
      const { getByTestId, queryByTestId } = render(<HomeTab />);
      await waitFor(() => {
        expect(getByTestId('book-progress')).toBeTruthy();
      });
      expect(getByTestId('book-progress-fraction').props.children).toBe('12/50');
      expect(queryByTestId('book-progress-cta')).toBeNull();
    });
  });

  describe('TC-007-07-B — n = 50: CTA 전환 + 자서전 탭 라우팅', () => {
    it('renders the "책 만들기" CTA and routes to /(tabs)/memoir on press', async () => {
      // child ordinal=1 fallback → 50
      mockActiveChildRef.current = {
        kind: 'child' as const,
        ordinal: 1,
        dueOrBirthDate: '2024-03-01',
        displayName: '서연',
        profileImageUrl: null,
      };
      const { getByTestId, queryByTestId } = render(<HomeTab />);
      await waitFor(() => {
        expect(getByTestId('book-progress-cta')).toBeTruthy();
      });
      expect(queryByTestId('book-progress-fraction')).toBeNull();

      fireEvent.press(getByTestId('book-progress-cta'));
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/memoir');
    });
  });

  describe('TC-007-07-C — 다자녀 활성 전환 시 카운트 독립', () => {
    it('returns different counts for different ordinals (fetus 1 vs 2)', async () => {
      const { getByTestId, queryByTestId, rerender } = render(<HomeTab />);
      // fetus ordinal=1 → 12
      await waitFor(() => {
        expect(getByTestId('book-progress-fraction').props.children).toBe('12/50');
      });

      // ordinal 2 로 활성 아이 전환 → fallback=50 (CTA 분기)
      await act(async () => {
        mockActiveChildRef.current = {
          kind: 'fetus' as const,
          ordinal: 2,
          dueOrBirthDate: '2026-08-10',
          displayName: '샛별',
          profileImageUrl: null,
        };
        rerender(<HomeTab />);
      });

      await waitFor(() => {
        expect(getByTestId('book-progress-cta')).toBeTruthy();
      });
      expect(queryByTestId('book-progress-fraction')).toBeNull();
    });
  });
});
