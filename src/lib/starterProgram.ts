/**
 * A ready-made three-day program, so a new install has something to train
 * rather than an empty Routines tab.
 *
 * It is a Greyskull-style linear progression restructured onto a
 * Monday/Wednesday/Friday week: squat and bench twice, one heavy deadlift, and
 * direct arm work on two days. Pure data — installStarterProgram in
 * db/starterProgram.ts is what writes it.
 *
 * Two places the source program says more than this file can hold:
 *
 * - AMRAP. The program's main lifts are "2×5, 1×5+" — two fives then a third
 *   set for as many clean reps as you have. RoutineExercise has no open-ended
 *   ceiling (and suggestNext returns nothing at all without one), so those
 *   become a flat 3×5. Topping it out still earns the increment, which is the
 *   engine; what's lost is the "over 10 reps, double the jump" correction.
 * - Cues. There is nowhere to put "reset your grip between reps" or "90% of
 *   Monday's top set", so the coaching notes live outside the app.
 */

import type { ExerciseType } from '../db/db';
import type { MuscleGroup } from './muscles';

export interface StarterExercise {
  name: string;
  type: ExerciseType;
  defaultRestSeconds: number;
  /** Primary movers only. A set counts once per tag, so tagging every
   *  assisting muscle would make a thin program look well covered. */
  muscleGroups: MuscleGroup[];
  /** Left off where the program states no jump, to inherit the global default. */
  incrementLbs?: number;
  barLbs?: number;
}

export interface StarterEntry {
  /** Matches a StarterExercise name. */
  exercise: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
}

export interface StarterRoutine {
  name: string;
  /** 0 = Sunday, matching Routine.weekdays. */
  weekdays: number[];
  entries: StarterEntry[];
}

const BAR = 45;
/** An EZ curl bar is lighter than a barbell, and 25 lb is the common one. */
const EZ_BAR = 25;

export const STARTER_EXERCISES: StarterExercise[] = [
  // Monday
  { name: 'Back Squat', type: 'weighted', defaultRestSeconds: 180, muscleGroups: ['Quads', 'Glutes'], incrementLbs: 5, barLbs: BAR },
  { name: 'Bench Press', type: 'weighted', defaultRestSeconds: 180, muscleGroups: ['Chest'], incrementLbs: 2.5, barLbs: BAR },
  { name: 'Pull-up', type: 'bodyweight', defaultRestSeconds: 90, muscleGroups: ['Back'] },
  { name: 'EZ-Bar Curl', type: 'weighted', defaultRestSeconds: 75, muscleGroups: ['Biceps'], barLbs: EZ_BAR },
  { name: 'Rope Pushdown', type: 'weighted', defaultRestSeconds: 75, muscleGroups: ['Triceps'] },
  { name: 'Hanging Leg Raise', type: 'bodyweight', defaultRestSeconds: 60, muscleGroups: ['Core'] },
  // Wednesday
  { name: 'Deadlift', type: 'weighted', defaultRestSeconds: 210, muscleGroups: ['Hamstrings', 'Glutes'], incrementLbs: 5, barLbs: BAR },
  { name: 'Overhead Press', type: 'weighted', defaultRestSeconds: 150, muscleGroups: ['Shoulders'], incrementLbs: 2.5, barLbs: BAR },
  { name: 'Chest-Supported Row', type: 'weighted', defaultRestSeconds: 90, muscleGroups: ['Back'] },
  { name: 'Lat Pulldown', type: 'weighted', defaultRestSeconds: 75, muscleGroups: ['Back'] },
  { name: 'Face Pull', type: 'weighted', defaultRestSeconds: 60, muscleGroups: ['Shoulders'] },
  // Friday. The squat and pull-up here are separate exercises from Monday's on
  // purpose: Friday's squat is 90% of Monday's and Friday's pull-up is the
  // weighted day, so one shared history would have suggestNext averaging two
  // different jobs and dragging both toward the middle.
  { name: 'Back Squat (Volume)', type: 'weighted', defaultRestSeconds: 150, muscleGroups: ['Quads', 'Glutes'], incrementLbs: 5, barLbs: BAR },
  { name: 'Romanian Deadlift', type: 'weighted', defaultRestSeconds: 120, muscleGroups: ['Hamstrings', 'Glutes'], incrementLbs: 5, barLbs: BAR },
  { name: 'Weighted Pull-up', type: 'weighted', defaultRestSeconds: 120, muscleGroups: ['Back'], incrementLbs: 2.5 },
  { name: 'Incline DB Curl', type: 'weighted', defaultRestSeconds: 75, muscleGroups: ['Biceps'] },
  { name: 'Overhead Triceps Extension', type: 'weighted', defaultRestSeconds: 75, muscleGroups: ['Triceps'] },
];

export const STARTER_ROUTINES: StarterRoutine[] = [
  {
    name: 'Squat & Bench',
    weekdays: [1],
    entries: [
      { exercise: 'Back Squat', targetSets: 3, targetRepsMin: 5, targetRepsMax: 5 },
      { exercise: 'Bench Press', targetSets: 3, targetRepsMin: 5, targetRepsMax: 5 },
      // "Half your daily max, 2-3 in reserve" — practice volume, not a test.
      { exercise: 'Pull-up', targetSets: 3, targetRepsMin: 4, targetRepsMax: 6 },
      { exercise: 'EZ-Bar Curl', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12 },
      { exercise: 'Rope Pushdown', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12 },
      { exercise: 'Hanging Leg Raise', targetSets: 2, targetRepsMin: 10, targetRepsMax: 15 },
    ],
  },
  {
    name: 'Deadlift & Press',
    weekdays: [3],
    entries: [
      { exercise: 'Deadlift', targetSets: 2, targetRepsMin: 5, targetRepsMax: 5 },
      { exercise: 'Overhead Press', targetSets: 3, targetRepsMin: 5, targetRepsMax: 5 },
      { exercise: 'Chest-Supported Row', targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 },
      { exercise: 'Lat Pulldown', targetSets: 2, targetRepsMin: 12, targetRepsMax: 15 },
      { exercise: 'Face Pull', targetSets: 2, targetRepsMin: 15, targetRepsMax: 20 },
    ],
  },
  {
    name: 'Bench & Volume',
    weekdays: [5],
    entries: [
      { exercise: 'Bench Press', targetSets: 3, targetRepsMin: 5, targetRepsMax: 5 },
      { exercise: 'Back Squat (Volume)', targetSets: 3, targetRepsMin: 5, targetRepsMax: 5 },
      { exercise: 'Romanian Deadlift', targetSets: 3, targetRepsMin: 8, targetRepsMax: 8 },
      // Bodyweight until you clear 8, then start adding: logging 0 lb makes the
      // first increment land at 2.5 on its own.
      { exercise: 'Weighted Pull-up', targetSets: 3, targetRepsMin: 5, targetRepsMax: 8 },
      { exercise: 'Incline DB Curl', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12 },
      { exercise: 'Overhead Triceps Extension', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12 },
    ],
  },
];

export function starterExercise(name: string): StarterExercise | undefined {
  return STARTER_EXERCISES.find((e) => e.name === name);
}

/** What one run of installStarterProgram actually wrote. */
export interface StarterInstall {
  routinesAdded: number;
  exercisesCreated: number;
  /** Matched by name to something already in the library, and left alone. */
  exercisesReused: number;
}

export function installSummary(install: StarterInstall): string {
  const { routinesAdded, exercisesCreated, exercisesReused } = install;
  if (routinesAdded === 0 && exercisesCreated === 0 && exercisesReused === 0) {
    return 'Already installed — nothing to add';
  }

  const added = [
    routinesAdded > 0 ? `${routinesAdded} ${plural(routinesAdded, 'routine')}` : null,
    exercisesCreated > 0 ? `${exercisesCreated} ${plural(exercisesCreated, 'exercise')}` : null,
  ].filter((part) => part !== null);

  // "exercises" is only repeated when the first half didn't already say it.
  const noun = exercisesCreated > 0 ? '' : ` ${plural(exercisesReused, 'exercise')}`;
  const reused = exercisesReused > 0 ? ` · reused ${exercisesReused}${noun} you already had` : '';
  return `Added ${added.join(' and ')}${reused}`;
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
