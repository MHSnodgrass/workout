import { db } from './db';
import type { Exercise, ExerciseType, RoutineExercise, SetLog } from './db';
import { exerciseHasHistory, routineHasHistory } from './queries';

export class ActiveSessionExistsError extends Error {
  constructor() {
    super('A workout is already in progress');
  }
}

export class DuplicateExerciseNameError extends Error {
  constructor(name: string) {
    super(`An exercise named "${name}" already exists`);
  }
}

export async function startSession(routineId: number): Promise<number> {
  return db.transaction('rw', db.sessions, async () => {
    const active = await db.sessions.filter((s) => s.finishedAt === null).first();
    if (active) throw new ActiveSessionExistsError();
    return db.sessions.add({ routineId, startedAt: Date.now(), finishedAt: null });
  });
}

export async function finishSession(sessionId: number): Promise<void> {
  await db.sessions.update(sessionId, { finishedAt: Date.now() });
}

export async function updateSessionNote(sessionId: number, note: string): Promise<void> {
  await db.sessions.update(sessionId, { note });
}

export async function logSet(input: Omit<SetLog, 'id' | 'loggedAt'>): Promise<number> {
  return db.setLogs.add({ ...input, loggedAt: Date.now() });
}

export async function updateSet(
  setLogId: number,
  changes: Partial<Pick<SetLog, 'weightLbs' | 'reps' | 'durationSeconds'>>,
): Promise<void> {
  await db.setLogs.update(setLogId, changes);
}

export async function deleteSet(setLogId: number): Promise<void> {
  await db.setLogs.delete(setLogId);
}

export async function deleteSession(sessionId: number): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

export async function createExercise(
  name: string,
  type: ExerciseType,
  defaultRestSeconds: number,
): Promise<number> {
  const trimmed = name.trim();
  const clash = await db.exercises
    .filter((e) => e.archived === 0 && e.name.toLowerCase() === trimmed.toLowerCase())
    .first();
  if (clash) throw new DuplicateExerciseNameError(trimmed);
  return db.exercises.add({ name: trimmed, type, defaultRestSeconds, archived: 0 });
}

export async function updateExercise(
  exerciseId: number,
  changes: Partial<Pick<Exercise, 'name' | 'defaultRestSeconds' | 'incrementLbs'>>,
): Promise<void> {
  await db.exercises.update(exerciseId, changes);
}

export async function deleteExercise(exerciseId: number): Promise<'archived' | 'deleted'> {
  if (await exerciseHasHistory(exerciseId)) {
    await db.exercises.update(exerciseId, { archived: 1 });
    return 'archived';
  }
  await db.transaction('rw', db.exercises, db.routineExercises, async () => {
    await db.routineExercises.where('exerciseId').equals(exerciseId).delete();
    await db.exercises.delete(exerciseId);
  });
  return 'deleted';
}

export async function createRoutine(name: string): Promise<number> {
  return db.routines.add({ name: name.trim(), archived: 0 });
}

export async function renameRoutine(routineId: number, name: string): Promise<void> {
  await db.routines.update(routineId, { name: name.trim() });
}

export async function deleteRoutine(routineId: number): Promise<'archived' | 'deleted'> {
  if (await routineHasHistory(routineId)) {
    await db.routines.update(routineId, { archived: 1 });
    return 'archived';
  }
  await db.transaction('rw', db.routines, db.routineExercises, async () => {
    await db.routineExercises.where('routineId').equals(routineId).delete();
    await db.routines.delete(routineId);
  });
  return 'deleted';
}

export async function addExerciseToRoutine(routineId: number, exerciseId: number): Promise<number> {
  const existing = await db.routineExercises.where('routineId').equals(routineId).toArray();
  const order = existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.order)) + 1;
  const exercise = await db.exercises.get(exerciseId);
  const base = { routineId, exerciseId, order, targetSets: 3 };
  if (exercise?.type === 'timed') {
    return db.routineExercises.add({ ...base, targetDurationSeconds: 60 });
  }
  return db.routineExercises.add({ ...base, targetRepsMin: 8, targetRepsMax: 12 });
}

export async function updateRoutineExercise(
  id: number,
  changes: Partial<
    Pick<RoutineExercise, 'targetSets' | 'targetRepsMin' | 'targetRepsMax' | 'targetDurationSeconds'>
  >,
): Promise<void> {
  await db.routineExercises.update(id, changes);
}

export async function removeRoutineExercise(id: number): Promise<void> {
  await db.routineExercises.delete(id);
}

export async function moveRoutineExercise(
  routineId: number,
  routineExerciseId: number,
  direction: -1 | 1,
): Promise<void> {
  await db.transaction('rw', db.routineExercises, async () => {
    const rows = await db.routineExercises.where('routineId').equals(routineId).sortBy('order');
    const index = rows.findIndex((r) => r.id === routineExerciseId);
    const neighbor = rows[index + direction];
    if (index === -1 || !neighbor) return;
    const current = rows[index];
    await db.routineExercises.update(current.id!, { order: neighbor.order });
    await db.routineExercises.update(neighbor.id!, { order: current.order });
  });
}
