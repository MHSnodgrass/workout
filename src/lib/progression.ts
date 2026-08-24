import type { Exercise, RoutineExercise, SetLog } from '../db/db';
import type { SessionSets } from '../db/queries';
import { round1 } from './format';

/**
 * Double progression: work up the rep range at a fixed load, then add weight
 * and drop back to the bottom of the range. Bodyweight work progresses reps to
 * a ceiling and then adds a set; timed work adds seconds.
 *
 * Pure and DB-free on purpose — the caller supplies last session's sets and the
 * increment to use, so the rules stay testable in isolation.
 */

const TIMED_INCREMENT_SECONDS = 5;

export interface Suggestion {
  weightLbs?: number;
  reps?: number;
  durationSeconds?: number;
  addSet?: boolean;
  note: string;
}

export function suggestNext(
  lastTime: SessionSets | null,
  re: RoutineExercise,
  exercise: Exercise,
  incrementLbs: number,
): Suggestion | null {
  if (!lastTime) return null;

  // Only the sets that count toward the target drive the decision; anything
  // logged beyond it is a bonus set, not a failure to hit the range.
  const sets = [...lastTime.sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .slice(0, re.targetSets);
  if (sets.length < re.targetSets) return null;

  switch (exercise.type) {
    case 'weighted':
      return weightedSuggestion(sets, re, incrementLbs);
    case 'bodyweight':
      return bodyweightSuggestion(sets, re);
    case 'timed':
      return timedSuggestion(sets, re);
  }
}

function weightedSuggestion(
  sets: SetLog[],
  re: RoutineExercise,
  incrementLbs: number,
): Suggestion | null {
  const ceiling = re.targetRepsMax;
  if (ceiling === undefined) return null;

  const weights = sets.map((s) => s.weightLbs);
  if (weights.some((w) => w === undefined)) return null;
  // The lightest working set is the load actually completed for every set, so
  // a ramped session progresses from its base rather than its top single.
  const working = Math.min(...(weights as number[]));

  if (sets.every((s) => (s.reps ?? 0) >= ceiling)) {
    const next = round1(working + incrementLbs);
    return {
      weightLbs: next,
      reps: re.targetRepsMin,
      note: `Try ${next} lb — you hit ${re.targetSets}×${ceiling} last time`,
    };
  }
  return {
    weightLbs: round1(working),
    reps: ceiling,
    note: `Stay at ${round1(working)} lb — aim for ${re.targetSets}×${ceiling}`,
  };
}

function bodyweightSuggestion(sets: SetLog[], re: RoutineExercise): Suggestion | null {
  const ceiling = re.targetRepsMax;
  if (ceiling === undefined) return null;

  if (sets.every((s) => (s.reps ?? 0) >= ceiling)) {
    return {
      addSet: true,
      reps: ceiling,
      note: `You hit ${re.targetSets}×${ceiling} — try a ${ordinal(re.targetSets + 1)} set`,
    };
  }
  return { reps: ceiling, note: `Aim for ${re.targetSets}×${ceiling}` };
}

function timedSuggestion(sets: SetLog[], re: RoutineExercise): Suggestion | null {
  const goal = re.targetDurationSeconds;
  if (goal === undefined) return null;

  if (sets.every((s) => (s.durationSeconds ?? 0) >= goal)) {
    const next = goal + TIMED_INCREMENT_SECONDS;
    return { durationSeconds: next, note: `Try ${next}s — you held ${goal}s last time` };
  }
  return { durationSeconds: goal, note: `Aim for ${re.targetSets}×${goal}s` };
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
