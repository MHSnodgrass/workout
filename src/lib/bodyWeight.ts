/**
 * Body-weight readings, smoothed.
 *
 * A daily weigh-in swings a couple of pounds on water alone, so the raw line
 * is close to unreadable and the raw first-to-last difference is mostly noise.
 * Everything here works off a trailing average instead.
 */

import { addDays, daysBetween, localMidnight } from './dates';
import { round1 } from './format';

export const AVERAGE_WINDOW_DAYS = 7;
export const TREND_DAYS = 30;

export interface WeightEntry {
  at: number;
  weightLbs: number;
}

export interface WeightPoint extends WeightEntry {
  /** Mean of every reading in the trailing window, this one included. */
  average: number;
}

export interface WeightTrend {
  /** Negative means the average came down. */
  changeLbs: number;
  days: number;
}

export function buildWeightSeries(
  entries: WeightEntry[],
  windowDays: number = AVERAGE_WINDOW_DAYS,
): WeightPoint[] {
  const sorted = [...entries].sort((a, b) => a.at - b.at);
  return sorted.map((entry, i) => {
    const from = addDays(localMidnight(entry.at), -(windowDays - 1));
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j -= 1) {
      if (localMidnight(sorted[j].at) < from) break;
      sum += sorted[j].weightLbs;
      count += 1;
    }
    return { ...entry, average: sum / count };
  });
}

/**
 * Change in the smoothed weight over the last `days`. Returns the span it
 * actually covered — asking for 30 days of a two-week log reports two weeks,
 * rather than implying a month of data that isn't there.
 */
export function weightTrend(
  entries: WeightEntry[],
  now: number,
  days: number = TREND_DAYS,
): WeightTrend | null {
  // Averaged over the full history: a reading's trailing window shouldn't be
  // starved just because the trend only looks back so far.
  const series = buildWeightSeries(entries);
  const cutoff = addDays(localMidnight(now), -days);
  const inWindow = series.filter((p) => localMidnight(p.at) >= cutoff);
  if (inWindow.length < 2) return null;
  const baseline = inWindow[0];
  const latest = inWindow[inWindow.length - 1];
  return {
    changeLbs: latest.average - baseline.average,
    days: daysBetween(baseline.at, latest.at),
  };
}

export function describeTrend(trend: WeightTrend): string {
  const span = `over ${trend.days} ${trend.days === 1 ? 'day' : 'days'}`;
  const change = round1(Math.abs(trend.changeLbs));
  if (change === 0) return `steady ${span}`;
  return `${trend.changeLbs < 0 ? 'down' : 'up'} ${change} lb ${span}`;
}
