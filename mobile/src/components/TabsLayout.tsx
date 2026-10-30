import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { font, useColors } from '../lib/theme';

type Icon = ComponentProps<typeof Ionicons>['name'];

/** Bottom tab bar shared by the manager, coach and parent apps. */
export function TabsLayout({ tabs }: { tabs: { name: string; title: string; icon: Icon; badge?: number }[] }) {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: font.bold, fontSize: 12 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} color={String(color)} size={size} />,
            tabBarBadge: t.badge ? t.badge : undefined,
          }}
        />
      ))}
    </Tabs>
  );
}
