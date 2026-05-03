/**
 * Date utilities that respect the user's local timezone.
 *
 * Background: `date.toISOString().slice(0, 10)` converts to UTC first,
 * which silently shifts the day for users in non-UTC offsets. Use the
 * helpers in this module for any "what day is it locally?" comparison
 * (activity history keys, day-strip lookups, calendar cells, etc.).
 *
 * Reserve UTC-based formatting only when interchange with another
 * UTC-keyed system is genuinely intended.
 */

/**
 * Format a Date as `YYYY-MM-DD` using the user's local timezone.
 */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convenience: today's local date as `YYYY-MM-DD`.
 */
export function getTodayLocalStr(): string {
  return toLocalDateStr(new Date());
}

/**
 * Parse a `YYYY-MM-DD` string as a local Date at midnight.
 *
 * `new Date('2026-04-23')` is parsed as UTC midnight, which renders as
 * the previous day for users in negative UTC offsets. Use this helper
 * whenever you need to display, format, or compare a date string that
 * was produced by `toLocalDateStr` / `getTodayLocalStr`.
 */
export function parseLocalDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}
