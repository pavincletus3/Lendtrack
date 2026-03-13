import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays } from 'date-fns';
import type { Loan } from '@/types';
import { getDueDate, currentMonthKey } from './calculations';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Not supported in Expo Go — ignore
  }
}

/**
 * Schedule local notifications for all active loans.
 * Silently skipped in Expo Go (not supported since SDK 53).
 */
export async function scheduleNotificationsForLoans(
  loans: Loan[],
  overdueAlertDays: number,
  lang: 'en' | 'ta'
): Promise<void> {
  try {
    await cancelAllNotifications();

    const activeLoans = loans.filter((l) => l.status === 'active');
    const monthKey = currentMonthKey();

    for (const loan of activeLoans) {
      const dueDate = getDueDate(loan, monthKey);
      const now = new Date();

      if (dueDate > now) {
        const dueTitle = lang === 'ta'
          ? `${loan.borrowerName} - வட்டி நினைவூட்டல்`
          : `${loan.borrowerName} - Interest Due`;
        const dueBody = lang === 'ta'
          ? 'இந்த மாதம் வட்டி செலுத்த வேண்டும்'
          : 'Interest payment is due this month';

        await Notifications.scheduleNotificationAsync({
          content: { title: dueTitle, body: dueBody },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dueDate,
          },
        });
      }

      const overdueDate = addDays(dueDate, overdueAlertDays);
      if (overdueDate > new Date()) {
        const overdueTitle = lang === 'ta'
          ? `${loan.borrowerName} - வட்டி தாமதம்!`
          : `${loan.borrowerName} - Interest Overdue!`;
        const overdueBody = lang === 'ta'
          ? `${overdueAlertDays} நாட்கள் கடந்துவிட்டன — வட்டி இன்னும் வரவில்லை`
          : `${overdueAlertDays} days past due — interest not yet received`;

        await Notifications.scheduleNotificationAsync({
          content: { title: overdueTitle, body: overdueBody },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: overdueDate,
          },
        });
      }
    }
  } catch {
    // Notifications not fully supported in Expo Go — silently skip
  }
}
