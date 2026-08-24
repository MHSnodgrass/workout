/**
 * Muscle-group coverage: how much work each group got recently.
 *
 * A fixed vocabulary rather than free text — typed tags fragment into
 * "chest"/"Chest"/"pecs" within a week, and then the counts mean nothing.
 * Ten groups is enough to answer "is this split balanced?" without turning
 * into an anatomy project.
 */

import { addDays, localMidnight } from './dates';

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const COVERAGE_DAYS = 7;

export interface GroupCount {
  group: string;
  sets: number;
}

export interface Coverage {
  /** Every group, busiest first. A set counts once toward each of its groups,
   *  so these deliberately sum to more than the number of sets logged. */
  counts: GroupCount[];
  taggedSets: number;
  untaggedSets: number;
}

interface LoggedSet {
  exerciseId: number;
  loggedAt: number;
}

export function muscleCoverage(
  sets: LoggedSet[],
  groupsByExercise: Map<number, string[]>,
  now: number,
  days: number = COVERAGE_DAYS,
): Coverage {
  const from = addDays(localMidnight(now), -(days - 1));
  const tally = new Map<string, number>(MUSCLE_GROUPS.map((g) => [g, 0]));
  let taggedSets = 0;
  let untaggedSets = 0;

  for (const set of sets) {
    if (localMidnight(set.loggedAt) < from) continue;
    const groups = (groupsByExercise.get(set.exerciseId) ?? []).filter((g) => tally.has(g));
    if (groups.length === 0) {
      untaggedSets += 1;
      continue;
    }
    taggedSets += 1;
    for (const g of groups) tally.set(g, (tally.get(g) ?? 0) + 1);
  }

  const order = new Map(MUSCLE_GROUPS.map((g, i) => [g as string, i]));
  const counts = [...tally.entries()]
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets || order.get(a.group)! - order.get(b.group)!);

  return { counts, taggedSets, untaggedSets };
}
