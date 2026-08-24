/**
 * Which weekdays a routine is meant for.
 *
 * A hint, never a rule: Home badges and sorts today's routines, but every
 * routine stays startable on any day. Days are stored as `Date#getDay`
 * numbers, 0 = Sunday.
 */

export interface Weekday {
  index: number;
  /** Single letter for the toggle chips. */
  initial: string;
  short: string;
}

export const WEEKDAYS: Weekday[] = [
  { index: 0, initial: 'S', short: 'Sun' },
  { index: 1, initial: 'M', short: 'Mon' },
  { index: 2, initial: 'T', short: 'Tue' },
  { index: 3, initial: 'W', short: 'Wed' },
  { index: 4, initial: 'T', short: 'Thu' },
  { index: 5, initial: 'F', short: 'Fri' },
  { index: 6, initial: 'S', short: 'Sat' },
];

export function isScheduledToday(weekdays: number[] | undefined, now: number): boolean {
  return weekdays?.includes(new Date(now).getDay()) ?? false;
}

export function scheduleLabel(weekdays: number[] | undefined): string {
  if (weekdays === undefined || weekdays.length === 0) return '';
  if (weekdays.length >= WEEKDAYS.length) return 'Every day';
  const names = WEEKDAYS.filter((d) => weekdays.includes(d.index)).map((d) => d.short);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
