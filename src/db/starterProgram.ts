import { db } from './db';
import {
  STARTER_ROUTINES,
  type StarterExercise,
  type StarterInstall,
  type StarterRoutine,
  starterExercise,
} from '../lib/starterProgram';

/**
 * Writes the starter program, adding only what is missing.
 *
 * Safe to run more than once: a routine whose name is already in use is
 * skipped whole, and an exercise you already have is reused as it is rather
 * than reconfigured — your rest time and increment are your business, and
 * silently rewriting them would be the install undoing your tuning.
 */
export async function installStarterProgram(): Promise<StarterInstall> {
  return db.transaction('rw', db.routines, db.routineExercises, db.exercises, async () => {
    const install: StarterInstall = { routinesAdded: 0, exercisesCreated: 0, exercisesReused: 0 };
    const existing = await db.routines.filter((r) => r.archived === 0).toArray();
    const taken = new Set(existing.map((r) => r.name.toLowerCase()));
    // Resolved lazily, so a run that installs nothing also creates nothing.
    const ids = new Map<string, number>();

    for (const routine of STARTER_ROUTINES) {
      if (taken.has(routine.name.toLowerCase())) continue;
      await addRoutine(routine, ids, install);
      install.routinesAdded += 1;
    }
    return install;
  });
}

async function addRoutine(
  routine: StarterRoutine,
  ids: Map<string, number>,
  install: StarterInstall,
): Promise<void> {
  const routineId = await db.routines.add({
    name: routine.name,
    archived: 0,
    weekdays: routine.weekdays,
  });

  for (const [index, entry] of routine.entries.entries()) {
    const plan = starterExercise(entry.exercise);
    if (!plan) continue;
    const exerciseId = await resolveExercise(plan, ids, install);
    await db.routineExercises.add({
      routineId,
      exerciseId,
      // Spaced so a lift can be dragged between two others later without a
      // renumber; moveRoutineExercise only ever swaps the values it finds.
      order: (index + 1) * 10,
      targetSets: entry.targetSets,
      targetRepsMin: entry.targetRepsMin,
      targetRepsMax: entry.targetRepsMax,
    });
  }
}

async function resolveExercise(
  plan: StarterExercise,
  ids: Map<string, number>,
  install: StarterInstall,
): Promise<number> {
  const key = plan.name.toLowerCase();
  const known = ids.get(key);
  if (known !== undefined) return known;

  const match = await db.exercises
    .filter((e) => e.archived === 0 && e.name.toLowerCase() === key)
    .first();
  if (match) {
    ids.set(key, match.id!);
    install.exercisesReused += 1;
    return match.id!;
  }

  const id = await db.exercises.add({
    name: plan.name,
    type: plan.type,
    defaultRestSeconds: plan.defaultRestSeconds,
    archived: 0,
    muscleGroups: [...plan.muscleGroups],
    ...(plan.incrementLbs !== undefined ? { incrementLbs: plan.incrementLbs } : {}),
    ...(plan.barLbs !== undefined ? { barLbs: plan.barLbs } : {}),
  });
  ids.set(key, id);
  install.exercisesCreated += 1;
  return id;
}
