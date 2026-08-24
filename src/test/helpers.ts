import { db } from '../db/db';
import type { Exercise, Routine, Session, SetLog } from '../db/db';

export async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}

let counter = 0;

export async function seedExercise(over: Partial<Exercise> = {}): Promise<number> {
  counter += 1;
  return db.exercises.add({
    name: `Exercise ${counter}`,
    type: 'weighted',
    defaultRestSeconds: 90,
    archived: 0,
    ...over,
  });
}

export async function seedRoutine(over: Partial<Routine> = {}): Promise<number> {
  counter += 1;
  return db.routines.add({ name: `Routine ${counter}`, archived: 0, ...over });
}

export async function seedSession(routineId: number, over: Partial<Session> = {}): Promise<number> {
  return db.sessions.add({ routineId, startedAt: Date.now(), finishedAt: Date.now(), ...over });
}

export async function seedSet(
  sessionId: number,
  exerciseId: number,
  over: Partial<SetLog> = {},
): Promise<number> {
  const count = await db.setLogs
    .where('sessionId')
    .equals(sessionId)
    .and((s) => s.exerciseId === exerciseId)
    .count();
  return db.setLogs.add({
    sessionId,
    exerciseId,
    setNumber: count + 1,
    weightLbs: 135,
    reps: 10,
    loggedAt: Date.now(),
    ...over,
  });
}
