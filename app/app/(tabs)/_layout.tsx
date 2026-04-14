import { Tabs } from 'expo-router';

import { colors } from '../../src/theme/colors';
import { fontFamilies } from '../../src/theme/fonts';

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
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="records" options={{ title: '기록' }} />
      <Tabs.Screen name="settings" options={{ title: '마이' }} />
    </Tabs>
  );
}
