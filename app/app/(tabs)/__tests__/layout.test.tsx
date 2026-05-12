// Tabs layout unit test — PRD-007 AC-007-10 (5탭 고정 네비게이션).
// expo-router 의 `Tabs` 는 jest 환경에서 실제 네비게이터를 구성하기 어려워,
// `Tabs.Screen` 호출 자체를 mock 하여 등록된 5개 스크린의 name·title 순서만
// 검증한다. 본 화면 렌더링/탭 이동 시각 검증은 home-nav-5tabs.yaml(E2E)에 위임.

import { render } from '@testing-library/react-native';

type ScreenConfig = { name: string; title?: string };
const registered: ScreenConfig[] = [];

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Tabs = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  Tabs.Screen = ({ name, options }: { name: string; options?: { title?: string } }) => {
    registered.push({ name, title: options?.title });
    return null;
  };
  return { Tabs };
});

import TabsLayout from '../_layout';

describe('(tabs)/_layout — 5탭 고정 네비게이션', () => {
  beforeEach(() => {
    registered.length = 0;
  });

  it('registers 5 tabs in PRD-007 order with Home centered', () => {
    render(<TabsLayout />);
    expect(registered).toEqual([
      { name: 'memoir', title: '자서전' },
      { name: 'community', title: '커뮤니티' },
      { name: 'index', title: '홈' },
      { name: 'diary', title: '일기' },
      { name: 'settings', title: '설정' },
    ]);
  });

  it('places the Home tab in the middle slot', () => {
    render(<TabsLayout />);
    expect(registered).toHaveLength(5);
    expect(registered[2]).toEqual({ name: 'index', title: '홈' });
  });
});
