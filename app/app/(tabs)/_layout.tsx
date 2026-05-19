import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { colors } from '../../src/theme/colors';
import { fontFamilies } from '../../src/theme/fonts';

// PRD-007 AC-007-10 — 5탭 고정 네비게이션. 홈이 중앙(3번)에 위치하여
// 양손 엄지 접근성을 우선한다. 자서전·커뮤니티 탭은 본 작업 범위에서
// placeholder 만 제공한다.
//
// 헤더는 각 화면이 직접 그리므로 (예: HomeHeader) Tabs 의 screen header 는
// 끈다 — 시각 출처는 docs/mockups/source/src/screens/HomePregnancyScreen.tsx.
// 탭바 아이콘은 mockup (Common.tsx Tabbar) 의 이모지를 그대로 사용한다.
const tabIcon = (glyph: string) => () =>
  <Text style={{ fontSize: 20 }}>{glyph}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg.cream },
        tabBarStyle: {
          backgroundColor: colors.surface.ivory,
          borderTopColor: colors.bg.beige,
        },
        tabBarActiveTintColor: colors.primary.coral,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: {
          fontFamily: fontFamilies.sansSemibold,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="memoir"
        options={{
          title: '자서전',
          tabBarIcon: tabIcon('📖'),
          tabBarButtonTestID: 'tab-button-memoir',
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '커뮤니티',
          tabBarIcon: tabIcon('💬'),
          tabBarButtonTestID: 'tab-button-community',
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: tabIcon('🏠'),
          tabBarButtonTestID: 'tab-button-home',
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: '일기',
          tabBarIcon: tabIcon('📓'),
          tabBarButtonTestID: 'tab-button-diary',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: tabIcon('⚙️'),
          tabBarButtonTestID: 'tab-button-settings',
        }}
      />
    </Tabs>
  );
}
