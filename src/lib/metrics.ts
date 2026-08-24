import type { ExerciseType, Session, SetLog } from '../db/db';
import type { SessionSets } from '../db/queries';

export type MetricKey = 'e1rm' | 'topWeight' | 'volume' | 'totalReps' | 'maxDuration';

export function epley1RM(weightLbs: number, reps: number): number {
  return reps === 1 ? weightLbs : weightLbs * (1 + reps / 30);
}

export function bestE1RM(sets: SetLog[]): number {
  return sets.reduce(
    (best, s) =>
      s.weightLbs !== undefined && s.reps !== undefined
        ? Math.max(best, epley1RM(s.weightLbs, s.reps))
        : best,
    0,
  );
}

export function topWeight(sets: SetLog[]): number {
  return sets.reduce((best, s) => Math.max(best, s.weightLbs ?? 0), 0);
}

export function totalVolume(sets: SetLog[]): number {
  return sets.reduce((sum, s) => sum + (s.weightLbs ?? 0) * (s.reps ?? 0), 0);
}

export function totalReps(sets: SetLog[]): number {
  return sets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
}

export function maxDuration(sets: SetLog[]): number {
  return sets.reduce((best, s) => Math.max(best, s.durationSeconds ?? 0), 0);
}

export function metricValue(metric: MetricKey, sets: SetLog[]): number {
  switch (metric) {
    case 'e1rm':
      return bestE1RM(sets);
    case 'topWeight':
      return topWeight(sets);
    case 'volume':
      return totalVolume(sets);
    case 'totalReps':
      return totalReps(sets);
    case 'maxDuration':
      return maxDuration(sets);
  }
}

export function defaultMetricFor(type: ExerciseType): MetricKey {
  switch (type) {
    case 'weighted':
      return 'e1rm';
    case 'bodyweight':
      return 'totalReps';
    case 'timed':
      return 'maxDuration';
  }
}

export function availableMetricsFor(type: ExerciseType): MetricKey[] {
  switch (type) {
    case 'weighted':
      return ['e1rm', 'topWeight', 'volume'];
    case 'bodyweight':
      return ['totalReps', 'e1rm'];
    case 'timed':
      return ['maxDuration'];
  }
}

/** Metrics that a single set can own; the rest are session totals. */
const SET_LEVEL_METRICS: MetricKey[] = ['e1rm', 'topWeight', 'maxDuration'];

function setValue(metric: MetricKey, set: SetLog): number {
  switch (metric) {
    case 'e1rm':
      return set.weightLbs !== undefined && set.reps !== undefined
        ? epley1RM(set.weightLbs, set.reps)
        : 0;
    case 'topWeight':
      return set.weightLbs ?? 0;
    case 'maxDuration':
      return set.durationSeconds ?? 0;
    default:
      return 0;
  }
}

export interface BestOccurrence {
  value: number;
  session: Session;
  /** The set that produced it — absent for metrics that are session totals. */
  set?: SetLog;
}

/**
 * The record for a metric, plus where it happened. Ties go to the earliest
 * session: a record belongs to the day it was first set, not the last time it
 * was matched.
 */
export function bestOccurrence(metric: MetricKey, history: SessionSets[]): BestOccurrence | null {
  const oldestFirst = [...history].sort((a, b) => a.session.startedAt - b.session.startedAt);
  let best: BestOccurrence | null = null;

  for (const { session, sets } of oldestFirst) {
    if (SET_LEVEL_METRICS.includes(metric)) {
      for (const set of sets) {
        const value = setValue(metric, set);
        if (value > 0 && (best === null || value > best.value)) best = { value, session, set };
      }
    } else {
      const value = metricValue(metric, sets);
      if (value > 0 && (best === null || value > best.value)) best = { value, session };
    }
  }
  return best;
}

export interface SessionPoint {
  sessionId: number;
  date: number;
  value: number;
  isPR: boolean;
}

export function buildSeries(history: SessionSets[], metric: MetricKey): SessionPoint[] {
  const sorted = [...history].sort((a, b) => a.session.startedAt - b.session.startedAt);
  let best = -Infinity;
  return sorted.map(({ session, sets }) => {
    const value = metricValue(metric, sets);
    const isPR = value > best && value > 0;
    if (value > best) best = value;
    return { sessionId: session.id!, date: session.startedAt, value, isPR };
  });
}
