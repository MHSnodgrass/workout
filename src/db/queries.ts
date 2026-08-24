import { db } from './db';
import type { Session, SetLog } from './db';

export interface SessionSets {
  session: Session;
  sets: SetLog[];
}

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.finishedAt === null).first();
}

export async function getExerciseHistory(exerciseId: number): Promise<SessionSets[]> {
  const logs = await db.setLogs.where('exerciseId').equals(exerciseId).toArray();
  const bySession = new Map<number, SetLog[]>();
  for (const log of logs) {
    const arr = bySession.get(log.sessionId);
    if (arr) arr.push(log);
    else bySession.set(log.sessionId, [log]);
  }
  const sessions = (await db.sessions.bulkGet([...bySession.keys()])).filter(
    (s): s is Session => s !== undefined && s.finishedAt !== null,
  );
  return sessions
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((session) => ({
      session,
      sets: bySession.get(session.id!)!.sort((x, y) => x.setNumber - y.setNumber),
    }));
}

export async function getLastTime(
  exerciseId: number,
  excludeSessionId?: number,
): Promise<SessionSets | null> {
  const history = await getExerciseHistory(exerciseId);
  const eligible = history.filter((h) => h.session.id !== excludeSessionId);
  return eligible.length > 0 ? eligible[eligible.length - 1] : null;
}

export async function getLastFinishedSessionDate(routineId: number): Promise<number | null> {
  const sessions = await db.sessions.where('routineId').equals(routineId).toArray();
  const finished = sessions.filter((s) => s.finishedAt !== null);
  if (finished.length === 0) return null;
  return Math.max(...finished.map((s) => s.startedAt));
}

export async function exerciseHasHistory(exerciseId: number): Promise<boolean> {
  return (await db.setLogs.where('exerciseId').equals(exerciseId).count()) > 0;
}

export async function routineHasHistory(routineId: number): Promise<boolean> {
  return (await db.sessions.where('routineId').equals(routineId).count()) > 0;
}
