/**
 * The seeded exercise library: searching a vendored dataset and translating it
 * into this app's vocabulary.
 *
 * The data itself is a build artifact (`src/data/seedExercises.ts`, produced by
 * `scripts/fetch-exercises.mjs`) and ships as its own lazy chunk. Everything
 * that decides what an entry *means* — its type, its muscle groups, whether it
 * matches what you typed — lives here instead, where it is testable in node.
 */

import type { ExerciseType } from '../db/db';
import { MUSCLE_GROUPS, type MuscleGroup } from './muscles';

export interface SeedExercise {
  name: string;
  /** free-exercise-db equipment name; '' where the dataset had null. */
  equipment: string;
  /** 'push' | 'pull' | 'static'; '' where the dataset had null. */
  force: string;
  category: string;
  /** free-exercise-db muscle names — see SEED_MUSCLE_MAP for the translation. */
  primaryMuscles: string[];
}

export const SEED_RESULT_LIMIT = 30;

/**
 * free-exercise-db's seventeen muscle names onto our ten.
 *
 * Only *primary* muscles are ever mapped. Tagging secondaries would put a bench
 * press under Chest, Shoulders and Triceps at once, and #8's coverage bars —
 * which count a set once per group — would read full no matter what you trained.
 *
 * Two names have no exact home and are filed by what trains alongside them:
 * abductors are the glute medius, and the adductor magnus is a hip extensor.
 * Two more have no home at all and are deliberately absent: our vocabulary has
 * no Forearms and no Neck, so those import untagged rather than mistagged.
 */
const SEED_MUSCLE_MAP: Record<string, MuscleGroup> = {
  abdominals: 'Core',
  abductors: 'Glutes',
  adductors: 'Glutes',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  lats: 'Back',
  'lower back': 'Back',
  'middle back': 'Back',
  quadriceps: 'Quads',
  shoulders: 'Shoulders',
  traps: 'Back',
  triceps: 'Triceps',
};

const CANONICAL_ORDER = new Map<string, number>(MUSCLE_GROUPS.map((g, i) => [g as string, i]));

export function mapSeedMuscles(primaryMuscles: string[]): string[] {
  const groups = new Set<string>();
  for (const name of primaryMuscles) {
    const group = SEED_MUSCLE_MAP[name];
    if (group) groups.add(group);
  }
  return [...groups].sort((a, b) => CANONICAL_ORDER.get(a)! - CANONICAL_ORDER.get(b)!);
}

/**
 * The dataset has no notion of our three types, but it has two fields that
 * imply them: a static hold is something you time, and "body only" is something
 * you can't load. `type` is fixed once an exercise exists, so the picker shows
 * this as an editable default rather than applying it silently.
 */
export function seedType(entry: SeedExercise): ExerciseType {
  if (entry.force === 'static') return 'timed';
  if (entry.equipment === '' || entry.equipment === 'body only') return 'bodyweight';
  return 'weighted';
}

/**
 * Whether this loads onto a bar, and so has a plate breakdown worth showing.
 * Only two of the dataset's twelve equipment names do — a plate breakdown on a
 * dumbbell curl or a cable row would be nonsense.
 */
export function usesBarbell(entry: SeedExercise): boolean {
  return entry.equipment === 'barbell' || entry.equipment === 'e-z curl bar';
}

/**
 * Three tiers, because a name match alone ranks badly here: searching "chest"
 * otherwise leads with medicine-ball drills called "Chest Push" while every
 * bench press sits below them.
 *
 * Loaded barbell and dumbbell work first — that is what this app tracks —
 * then drills, then stretches, which stay searchable only because the app can
 * time a hold.
 */
function categoryRank(category: string): number {
  if (category === 'stretching') return 2;
  if (category === 'plyometrics' || category === 'strongman') return 1;
  return 0;
}

export function searchSeed(
  entries: SeedExercise[],
  query: string,
  { exclude, limit = SEED_RESULT_LIMIT }: { exclude?: Set<string>; limit?: number } = {},
): { results: SeedExercise[]; total: number } {
  const q = query.trim().toLowerCase();
  const matches = entries.filter((e) => {
    const name = e.name.toLowerCase();
    if (exclude?.has(name)) return false;
    if (q === '') return true;
    return (
      name.includes(q) ||
      e.equipment.includes(q) ||
      mapSeedMuscles(e.primaryMuscles).some((g) => g.toLowerCase().includes(q))
    );
  });

  matches.sort((a, b) => {
    const rank = categoryRank(a.category) - categoryRank(b.category);
    if (rank !== 0) return rank;
    const prefix =
      Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q));
    if (prefix !== 0) return prefix;
    return a.name.localeCompare(b.name);
  });

  return { results: matches.slice(0, limit), total: matches.length };
}
