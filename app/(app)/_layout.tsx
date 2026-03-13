import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useLoansStore } from '@/store/loansStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import { scheduleNotificationsForLoans, requestNotificationPermission } from '@/lib/notifications';

export default function AppLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { subscribe, unsubscribe, loans } = useLoansStore();
  const { overdueAlertDays, language } = useSettingsStore();

  useEffect(() => {
    if (user) {
      subscribe(user.uid, overdueAlertDays);
      requestNotificationPermission();
    }
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (loans.length > 0) {
      scheduleNotificationsForLoans(loans, overdueAlertDays, language as 'en' | 'ta');
    }
  }, [loans]);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: 4,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabIconDefault,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('dashboard.title'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      {/* borrowers is a directory with its own _layout (Stack) + index */}
      <Tabs.Screen
        name="borrowers"
        options={{
          title: t('borrowers.title'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="monthly"
        options={{
          title: t('monthly.title'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
