/**
 * Training activity for the last year, as a GitHub-style grid.
 *
 * Days bucket by *local* calendar date — a set logged at 11pm belongs to that
 * evening, not to tomorrow in UTC. `today` is passed in rather than read from
 * the clock so the grid is deterministic and testable.
 */

import { addDays, localMidnight } from './dates';

export const WEEKS_SHOWN = 53;
const DAYS_SHOWN = WEEKS_SHOWN * 7;

export interface HeatmapDay {
  /** Local midnight for this day. */
  date: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface Heatmap {
  /** WEEKS_SHOWN columns of 7 days, each running Sunday to Saturday. */
  weeks: HeatmapDay[][];
  totalSets: number;
  workouts: number;
  activeDays: number;
}

interface LoggedSet {
  loggedAt: number;
  sessionId: number;
}

/**
 * Shades relative to the busiest day rather than by quartile. Quartiles read
 * better on dense histories but collapse badly here: a year of identical
 * sessions would put every day in the lowest band.
 */
function levelFor(count: number, max: number): HeatmapDay['level'] {
  if (count <= 0) return 0;
  const share = count / max;
  if (share > 0.75) return 4;
  if (share > 0.5) return 3;
  if (share > 0.25) return 2;
  return 1;
}

export interface MonthLabel {
  weekIndex: number;
  label: string;
}

/**
 * Where to print month names above the grid. Without these the year is
 * unreadable on a phone, where the per-day `title` tooltips never appear.
 */
export function monthLabels(weeks: HeatmapDay[][]): MonthLabel[] {
  const labels: MonthLabel[] = [];
  let previousMonth = -1;
  weeks.forEach((week, weekIndex) => {
    const start = new Date(week[0].date);
    if (start.getMonth() === previousMonth) return;
    previousMonth = start.getMonth();
    labels.push({ weekIndex, label: start.toLocaleDateString(undefined, { month: 'short' }) });
  });
  return labels;
}

export function buildHeatmap(sets: LoggedSet[], today: number): Heatmap {
  // The grid ends on the Saturday of this week, so today is always in the
  // final column and the columns stay whole weeks.
  const endOfWeek = addDays(localMidnight(today), 6 - new Date(today).getDay());
  const start = addDays(endOfWeek, -(DAYS_SHOWN - 1));

  const counts = new Map<number, number>();
  const sessions = new Set<number>();
  let totalSets = 0;

  for (const s of sets) {
    const day = localMidnight(s.loggedAt);
    if (day < start || day > endOfWeek) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
    sessions.add(s.sessionId);
    totalSets += 1;
  }

  const max = Math.max(...counts.values(), 0);
  const weeks: HeatmapDay[][] = [];
  for (let w = 0; w < WEEKS_SHOWN; w += 1) {
    const week: HeatmapDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(start, w * 7 + d);
      const count = counts.get(date) ?? 0;
      week.push({ date, count, level: levelFor(count, max) });
    }
    weeks.push(week);
  }

  return { weeks, totalSets, workouts: sessions.size, activeDays: counts.size };
}
