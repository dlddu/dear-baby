import { Tabs } from 'expo-router';

import { colors } from '../../src/theme/colors';
import { fontFamilies } from '../../src/theme/fonts';

// PRD-007 AC-007-10 — 5탭 고정 네비게이션. 홈이 중앙(3번)에 위치하여
// 양손 엄지 접근성을 우선한다. 자서전·커뮤니티 탭은 본 작업 범위에서
// placeholder 만 제공한다.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.bg.cream },
        headerTitleStyle: {
          color: colors.text.primary,
          fontFamily: fontFamilies.sansBold,
        },
        headerShadowVisible: false,
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
      <Tabs.Screen name="memoir" options={{ title: '자서전' }} />
      <Tabs.Screen name="community" options={{ title: '커뮤니티' }} />
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="diary" options={{ title: '일기' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
