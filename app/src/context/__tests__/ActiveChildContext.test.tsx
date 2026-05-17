// PRD-007 AC-007-02 — 활성 아이 컨텍스트의 정규화·영속화 잠금.
// (1) buildActiveChildren 의 합성 규칙(단일·다자녀·임신·양육 혼합),
// (2) AsyncStorage hydrate 후 마지막 활성 인덱스가 복원되는지를
// 단위 레벨에서 고정한다. next/prev 의 회전 동작은 HomeHeader 통합 테스트가
// 다룬다.

import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';

import type { User } from '../../api/types';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) =>
        Promise.resolve(store.has(key) ? store.get(key)! : null),
      ),
      setItem: jest.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
      __reset: () => store.clear(),
      __seed: (key: string, value: string) => store.set(key, value),
    },
  };
});

const mockUseAuth = jest.fn();
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActiveChildProvider,
  buildActiveChildren,
  useActiveChild,
} from '../ActiveChildContext';

const baseUser = {
  id: 'user-1',
  email: 'a@b.c',
  name: 'Mom',
  picture_url: '',
  onboarded_at: '2026-05-01T00:00:00Z',
  first_record_at: null,
  fetuses: [],
  children: [],
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
} satisfies User;

describe('buildActiveChildren — 정규화 규칙', () => {
  it('returns empty list when user is null', () => {
    expect(buildActiveChildren(null)).toEqual([]);
  });

  it('returns empty when arrays empty (cold post-signin state)', () => {
    expect(buildActiveChildren(baseUser)).toEqual([]);
  });

  it('orders children before fetuses, each by ordinal ascending', () => {
    const list = buildActiveChildren({
      ...baseUser,
      fetuses: [
        {
          ordinal: 2,
          nickname: '둥이',
          gender: null,
          pregnancy_week: null,
          due_date: '2026-09-01',
          purposes: [],
        },
        {
          ordinal: 1,
          nickname: '콩이',
          gender: null,
          pregnancy_week: null,
          due_date: '2026-09-01',
          purposes: [],
        },
      ],
      children: [
        {
          ordinal: 1,
          name: '하늘',
          gender: null,
          birth_date: '2024-01-01',
          bio: null,
          purposes: [],
        },
      ],
    });
    expect(list.map((c) => `${c.kind}:${c.displayName}`)).toEqual([
      'child:하늘',
      'fetus:콩이',
      'fetus:둥이',
    ]);
  });

  it('falls back to "우리 아이" when fetus nickname or child name is empty', () => {
    const list = buildActiveChildren({
      ...baseUser,
      fetuses: [
        {
          ordinal: 1,
          nickname: '   ',
          gender: null,
          pregnancy_week: null,
          due_date: '2026-09-01',
          purposes: [],
        },
      ],
      children: [
        {
          ordinal: 1,
          name: null,
          gender: null,
          birth_date: '2024-01-01',
          bio: null,
          purposes: [],
        },
      ],
    });
    expect(list[0].displayName).toBe('우리 아이');
    expect(list[1].displayName).toBe('우리 아이');
  });
});

// ─── Provider 영속화 ────────────────────────────────────────────────────────

function Probe() {
  const { activeChild, activeIndex, canNavigate } = useActiveChild();
  return (
    <View>
      <Text testID="name">{activeChild?.displayName ?? 'none'}</Text>
      <Text testID="index">{String(activeIndex)}</Text>
      <Text testID="canNav">{canNavigate ? 'yes' : 'no'}</Text>
    </View>
  );
}

describe('ActiveChildProvider — AsyncStorage 영속화', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    mockUseAuth.mockReset();
  });

  it('hydrates activeIndex from AsyncStorage on cold boot', async () => {
    (AsyncStorage as unknown as { __seed: (k: string, v: string) => void }).__seed(
      'active_child_index:user-1',
      '1',
    );
    mockUseAuth.mockReturnValue({
      user: {
        ...baseUser,
        children: [
          {
            ordinal: 1,
            name: '하늘',
            gender: null,
            birth_date: '2024-01-01',
            bio: null,
            purposes: [],
          },
        ],
        fetuses: [
          {
            ordinal: 1,
            nickname: '콩이',
            gender: null,
            pregnancy_week: null,
            due_date: '2026-09-01',
            purposes: [],
          },
        ],
      },
    });

    const { getByTestId } = render(
      <ActiveChildProvider>
        <Probe />
      </ActiveChildProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('index').props.children).toBe('1');
    });
    expect(getByTestId('name').props.children).toBe('콩이');
    expect(getByTestId('canNav').props.children).toBe('yes');
  });

  it('defaults to index 0 when no value is persisted yet', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        ...baseUser,
        fetuses: [
          {
            ordinal: 1,
            nickname: '콩이',
            gender: null,
            pregnancy_week: null,
            due_date: '2026-09-01',
            purposes: [],
          },
        ],
      },
    });

    const { getByTestId } = render(
      <ActiveChildProvider>
        <Probe />
      </ActiveChildProvider>,
    );
    await waitFor(() => {
      expect(getByTestId('name').props.children).toBe('콩이');
    });
    expect(getByTestId('index').props.children).toBe('0');
    expect(getByTestId('canNav').props.children).toBe('no');
  });

  it('clamps a persisted out-of-range index to the last valid position', async () => {
    (AsyncStorage as unknown as { __seed: (k: string, v: string) => void }).__seed(
      'active_child_index:user-1',
      '99',
    );
    mockUseAuth.mockReturnValue({
      user: {
        ...baseUser,
        fetuses: [
          {
            ordinal: 1,
            nickname: '콩이',
            gender: null,
            pregnancy_week: null,
            due_date: '2026-09-01',
            purposes: [],
          },
          {
            ordinal: 2,
            nickname: '둥이',
            gender: null,
            pregnancy_week: null,
            due_date: '2026-10-01',
            purposes: [],
          },
        ],
      },
    });

    const { getByTestId } = render(
      <ActiveChildProvider>
        <Probe />
      </ActiveChildProvider>,
    );
    await waitFor(() => {
      expect(getByTestId('index').props.children).toBe('1');
    });
    expect(getByTestId('name').props.children).toBe('둥이');
  });

  it('persists the new index when next() is called', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        ...baseUser,
        fetuses: [
          {
            ordinal: 1,
            nickname: '콩이',
            gender: null,
            pregnancy_week: null,
            due_date: '2026-09-01',
            purposes: [],
          },
          {
            ordinal: 2,
            nickname: '둥이',
            gender: null,
            pregnancy_week: null,
            due_date: '2026-10-01',
            purposes: [],
          },
        ],
      },
    });

    let api: ReturnType<typeof useActiveChild> | null = null;
    function Grabber() {
      api = useActiveChild();
      return null;
    }
    render(
      <ActiveChildProvider>
        <Grabber />
      </ActiveChildProvider>,
    );
    await waitFor(() => {
      expect(api).not.toBeNull();
    });
    await act(async () => {
      api!.next();
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'active_child_index:user-1',
      '1',
    );
  });
});
