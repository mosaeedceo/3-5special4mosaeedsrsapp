import { isNativePlatform } from '@/lib/platform';
import { translate } from '@/hooks/useTranslation';
import type { Language } from '@/types/lesson';

const REMINDER_ID = 1;

export interface ScheduleDailyReminderParams {
  time: string; // HH:MM (24h)
  dueCount: { lessons: number; cards: number; total: number };
  lang: Language;
}

// Pick the right plural form key (one vs. other) and resolve it through
// the shared translate() helper so the notification body uses the same
// i18n pipeline as the in-app t() calls.
const buildBody = (
  dueCount: ScheduleDailyReminderParams['dueCount'],
  lang: Language,
): string => {
  const { lessons, cards, total } = dueCount;
  if (total <= 0) return translate(lang, 'notifications.bodyAllCaughtUp');

  if (lessons > 0 && cards > 0) {
    if (lessons === 1 && cards === 1) return translate(lang, 'notifications.bodyDueOne');
    if (lessons === 1) return translate(lang, 'notifications.bodyDueLessonsOneCardsOther', { cards });
    if (cards === 1) return translate(lang, 'notifications.bodyDueLessonsOtherCardsOne', { lessons });
    return translate(lang, 'notifications.bodyDueLessonsOtherCardsOther', { lessons, cards });
  }
  if (lessons > 0) {
    return lessons === 1
      ? translate(lang, 'notifications.bodyDueLessonsOne')
      : translate(lang, 'notifications.bodyDueLessonsOther', { lessons });
  }
  return cards === 1
    ? translate(lang, 'notifications.bodyDueCardsOne')
    : translate(lang, 'notifications.bodyDueCardsOther', { cards });
};

/**
 * Schedule (or reschedule) the daily study reminder. No-op on web.
 * Returns true if scheduled, false otherwise.
 */
export const scheduleDailyReminder = async (
  params: ScheduleDailyReminderParams,
): Promise<boolean> => {
  if (!isNativePlatform()) return false;
  if (!params.time) return false;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return false;
    const [hours, minutes] = params.time.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    await LocalNotifications.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: translate(params.lang, 'notifications.title'),
        body: buildBody(params.dueCount, params.lang),
        schedule: { on: { hour: hours, minute: minutes }, repeats: true, allowWhileIdle: true },
      }],
    });
    return true;
  } catch {
    return false;
  }
};

export const cancelReminder = async (): Promise<void> => {
  if (!isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  } catch {
    /* noop */
  }
};

/**
 * Request notification permission (native only). Returns true if granted.
 */
export const requestReminderPermission = async (): Promise<boolean> => {
  if (!isNativePlatform()) return false;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.requestPermissions();
    return perm.display === 'granted';
  } catch {
    return false;
  }
};
