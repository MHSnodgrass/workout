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
export const DEFAULT_STALL_SESSIONS = 3;

export interface Suggestion {
  weightLbs?: number;
  reps?: number;
  durationSeconds?: number;
  addSet?: boolean;
  /** Set when the suggestion is a retreat rather than a hold or an advance. */
  deload?: boolean;
  note: string;
}

/**
 * @param history Finished sessions for this exercise, oldest first. Only the
 *   most recent drives the normal suggestion; the rest are what stall
 *   detection reads.
 */
export function suggestNext(
  history: SessionSets[],
  re: RoutineExercise,
  exercise: Exercise,
  incrementLbs: number,
  stallSessions: number = DEFAULT_STALL_SESSIONS,
): Suggestion | null {
  const lastTime = history.length > 0 ? history[history.length - 1] : null;
  if (!lastTime) return null;

  const sets = targetSetsOf(lastTime, re);
  if (sets === null) return null;

  switch (exercise.type) {
    case 'weighted':
      return weightedSuggestion(sets, re, incrementLbs, history, stallSessions);
    case 'bodyweight':
      return bodyweightSuggestion(sets, re);
    case 'timed':
      return timedSuggestion(sets, re);
  }
}

/**
 * The sets that count toward the target, in order. Anything logged beyond the
 * target is a bonus set, not a failure to hit the range. Null when the session
 * didn't reach the target count at all.
 */
function targetSetsOf(session: SessionSets, re: RoutineExercise): SetLog[] | null {
  const sets = [...session.sets].sort((a, b) => a.setNumber - b.setNumber).slice(0, re.targetSets);
  return sets.length < re.targetSets ? null : sets;
}

function weightedSuggestion(
  sets: SetLog[],
  re: RoutineExercise,
  incrementLbs: number,
  history: SessionSets[],
  stallSessions: number,
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

  const stuck = stallStreak(history, re, working);
  if (stuck >= stallSessions) {
    const lighter = deloadTo(working, incrementLbs);
    if (lighter !== null) {
      return {
        weightLbs: lighter,
        reps: re.targetRepsMin,
        deload: true,
        note: `Deload to ${lighter} lb — ${stuck} sessions stuck at ${round1(working)} lb`,
      };
    }
    // Nothing lighter to drop to, so fall through and hold.
  }

  return {
    weightLbs: round1(working),
    reps: ceiling,
    note: `Stay at ${round1(working)} lb — aim for ${re.targetSets}×${ceiling}`,
  };
}

/**
 * How many sessions in a row, counting back from the most recent, were worked
 * at `working` without reaching the top of the rep range. Changing the load or
 * hitting the range ends the streak — so working back up after a deload can't
 * immediately re-trigger one.
 */
function stallStreak(history: SessionSets[], re: RoutineExercise, working: number): number {
  const ceiling = re.targetRepsMax;
  if (ceiling === undefined) return 0;
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const sets = targetSetsOf(history[i], re);
    if (sets === null) break;
    const weights = sets.map((s) => s.weightLbs);
    if (weights.some((w) => w === undefined)) break;
    if (Math.min(...(weights as number[])) !== working) break;
    if (sets.every((s) => (s.reps ?? 0) >= ceiling)) break;
    streak += 1;
  }
  return streak;
}

/**
 * Roughly 10% off, snapped to the exercise's own increment so the suggestion
 * is a weight you can actually load. Null when that can't land below the
 * current weight — better to hold than to suggest the same number.
 */
function deloadTo(working: number, incrementLbs: number): number | null {
  const snapped = Math.round((working * 0.9) / incrementLbs) * incrementLbs;
  const next = snapped >= working ? working - incrementLbs : snapped;
  return next > 0 ? round1(next) : null;
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
