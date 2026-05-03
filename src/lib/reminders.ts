import { isNativePlatform } from '@/lib/platform';
import { en } from '@/lib/translations/en';
import { ar } from '@/lib/translations/ar';
import type { Language } from '@/types/lesson';

const REMINDER_ID = 1;

export interface ScheduleDailyReminderParams {
  time: string; // HH:MM (24h)
  dueCount: { lessons: number; cards: number; total: number };
  lang: Language;
}

// Pick the right plural form key. We use a small one/other rule (matching
// the rules in our t() helper) so the notification body reads naturally,
// e.g. "1 lesson due today" instead of "1 lesson(s) due today".
const buildBody = (
  dueCount: ScheduleDailyReminderParams['dueCount'],
  lang: Language,
): string => {
  const tr = lang === 'ar' ? ar : en;
  const n = tr.notifications as Record<string, string>;
  const fmt = (tpl: string | undefined, vars: Record<string, number>) =>
    (tpl || n.body).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

  const { lessons, cards, total } = dueCount;
  if (total <= 0) return n.bodyAllCaughtUp || n.body;

  if (lessons > 0 && cards > 0) {
    if (lessons === 1 && cards === 1) return fmt(n.bodyDueOne, {});
    if (lessons === 1) return fmt(n.bodyDueLessonsOneCardsOther, { cards });
    if (cards === 1) return fmt(n.bodyDueLessonsOtherCardsOne, { lessons });
    return fmt(n.bodyDueLessonsOtherCardsOther, { lessons, cards });
  }
  if (lessons > 0) {
    return lessons === 1
      ? fmt(n.bodyDueLessonsOne, {})
      : fmt(n.bodyDueLessonsOther, { lessons });
  }
  return cards === 1
    ? fmt(n.bodyDueCardsOne, {})
    : fmt(n.bodyDueCardsOther, { cards });
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
    const tr = params.lang === 'ar' ? ar : en;
    await LocalNotifications.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: tr.notifications.title,
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
