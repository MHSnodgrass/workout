/**
 * Local-calendar date arithmetic.
 *
 * Everything the app buckets by day — heatmap squares, body-weight entries —
 * uses the *local* date: a set logged at 11pm belongs to that evening, not to
 * tomorrow in UTC. Both helpers go through calendar parts rather than
 * millisecond math so a DST shift can't slide a day by an hour.
 */

export function localMidnight(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

export function daysBetween(from: number, to: number): number {
  return Math.round((localMidnight(to) - localMidnight(from)) / 86_400_000);
}
