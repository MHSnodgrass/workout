import type { ExerciseType, RoutineExercise, SetLog } from '../db/db';
import { formatRir } from './effort';
import type { MetricKey } from './metrics';

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

export function formatDaysAgo(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m ${s}s`;
}

export function elapsedSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function metricLabel(metric: MetricKey): string {
  switch (metric) {
    case 'e1rm':
      return 'est. 1RM';
    case 'topWeight':
      return 'top set';
    case 'volume':
      return 'volume';
    case 'totalReps':
      return 'total reps';
    case 'maxDuration':
      return 'max duration';
  }
}

export function formatSet(set: SetLog, type: ExerciseType): string {
  const effort = formatRir(set.rir);
  return effort === '' ? setBody(set, type) : `${setBody(set, type)} · ${effort}`;
}

function setBody(set: SetLog, type: ExerciseType): string {
  if (type === 'timed') {
    const base = `${set.durationSeconds ?? 0}s`;
    return set.weightLbs !== undefined ? `${base} @ ${set.weightLbs} lb` : base;
  }
  if (type === 'bodyweight') {
    return set.weightLbs !== undefined ? `+${set.weightLbs}×${set.reps ?? 0}` : `${set.reps ?? 0}`;
  }
  return `${set.weightLbs ?? 0}×${set.reps ?? 0}`;
}

export function targetLabel(re: RoutineExercise, type: ExerciseType): string {
  if (type === 'timed') return `${re.targetSets} × ${re.targetDurationSeconds ?? 0}s`;
  return `${re.targetSets} × ${re.targetRepsMin ?? 0}–${re.targetRepsMax ?? 0}`;
}
