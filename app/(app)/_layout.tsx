import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useLoansStore } from '@/store/loansStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import { scheduleNotificationsForLoans, requestNotificationPermission } from '@/lib/notifications';

export default function AppLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const { subscribe, unsubscribe, loans } = useLoansStore();
  const { overdueAlertDays, language } = useSettingsStore();

  useEffect(() => {
    if (initialized && !user) router.replace('/(auth)/login');
  }, [user, initialized]);

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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="loan" />
    </Stack>
  );
}
