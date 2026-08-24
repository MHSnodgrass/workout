import { db } from './db';
import type { Session, SetLog } from './db';
import { defaultMetricFor, metricValue, type MetricKey } from '../lib/metrics';

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

export interface PRResult {
  exerciseId: number;
  exerciseName: string;
  metric: MetricKey;
  value: number;
  previousBest: number | null;
}

export async function detectSessionPRs(sessionId: number): Promise<PRResult[]> {
  const session = await db.sessions.get(sessionId);
  if (!session) return [];
  const sets = await db.setLogs.where('sessionId').equals(sessionId).toArray();
  const byExercise = new Map<number, SetLog[]>();
  for (const s of sets) {
    const arr = byExercise.get(s.exerciseId);
    if (arr) arr.push(s);
    else byExercise.set(s.exerciseId, [s]);
  }
  const results: PRResult[] = [];
  for (const [exerciseId, exSets] of byExercise) {
    const exercise = await db.exercises.get(exerciseId);
    if (!exercise) continue;
    const metric = defaultMetricFor(exercise.type);
    const value = metricValue(metric, exSets);
    if (value <= 0) continue;
    const history = await getExerciseHistory(exerciseId);
    const earlier = history.filter(
      (h) => h.session.id !== sessionId && h.session.startedAt < session.startedAt,
    );
    const previousBest =
      earlier.length > 0 ? Math.max(...earlier.map((h) => metricValue(metric, h.sets))) : null;
    if (previousBest === null || value > previousBest) {
      results.push({ exerciseId, exerciseName: exercise.name, metric, value, previousBest });
    }
  }
  return results;
}
