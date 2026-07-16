import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { darkTheme } from '@/lib/theme';

/** Bottom tabs: Kolejka (default) · Dziś · Ustawienia (§9.3). Dark theme only in v1. */
export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: darkTheme.card,
          borderTopColor: darkTheme.hairline,
        },
        tabBarActiveTintColor: darkTheme.status.ready,
        tabBarInactiveTintColor: darkTheme.textMuted,
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('staff.tabQueue') }} />
      <Tabs.Screen name="dzis" options={{ title: t('staff.tabToday') }} />
      <Tabs.Screen name="ustawienia" options={{ title: t('staff.tabSettings') }} />
    </Tabs>
  );
}
