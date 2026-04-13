import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';

import { colors } from '../../src/theme/colors';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? colors.accentPeach : colors.textLight;
  const icons: Record<string, string> = {
    home: '🏠',
    records: '📋',
    questions: '💬',
    settings: '👤',
  };
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>{icons[name] ?? '•'}</Text>;
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const tabNames = state.routes.map(r => r.name);
  const midIndex = 2; // FAB sits between records and questions

  return (
    <View style={tabBarStyles.bar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = (options.title ?? route.name) as string;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Insert FAB before the third tab (questions)
        const items = [];
        if (index === midIndex) {
          items.push(
            <Pressable
              key="fab"
              style={tabBarStyles.fab}
              onPress={() => router.push('/recording')}
            >
              <Text style={tabBarStyles.fabIcon}>＋</Text>
            </Pressable>,
          );
        }

        items.push(
          <Pressable
            key={route.key}
            onPress={onPress}
            style={tabBarStyles.tab}
          >
            <TabIcon name={route.name === 'index' ? 'home' : route.name} focused={isFocused} />
            <Text
              style={[
                tabBarStyles.label,
                { color: isFocused ? colors.accentPeach : colors.textLight },
              ]}
            >
              {label}
            </Text>
          </Pressable>,
        );

        return items;
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="records" options={{ title: '기록' }} />
      <Tabs.Screen name="questions" options={{ title: '질문' }} />
      <Tabs.Screen name="settings" options={{ title: '마이' }} />
    </Tabs>
  );
}

const tabBarStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.tabBorder,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentPeach,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: colors.accentPeach,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
  },
});
