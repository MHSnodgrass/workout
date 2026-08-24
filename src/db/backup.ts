import { db } from './db';
import type { Exercise, Routine, RoutineExercise, Session, SetLog, Setting } from './db';

export const BACKUP_APP = 'workout-tracker';
export const SCHEMA_VERSION = 1;

export interface BackupFile {
  app: string;
  schemaVersion: number;
  exportedAt: number;
  exercises: Exercise[];
  routines: Routine[];
  routineExercises: RoutineExercise[];
  sessions: Session[];
  setLogs: SetLog[];
  settings: Setting[];
}

export async function buildBackup(): Promise<BackupFile> {
  return {
    app: BACKUP_APP,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    exercises: await db.exercises.toArray(),
    routines: await db.routines.toArray(),
    routineExercises: await db.routineExercises.toArray(),
    sessions: await db.sessions.toArray(),
    setLogs: await db.setLogs.toArray(),
    settings: await db.settings.toArray(),
  };
}

export type ValidationResult = { ok: true; data: BackupFile } | { ok: false; error: string };

const TABLE_KEYS = [
  'exercises',
  'routines',
  'routineExercises',
  'sessions',
  'setLogs',
  'settings',
] as const;

const EXERCISE_TYPES = ['weighted', 'bodyweight', 'timed'];

export function validateBackup(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Not a JSON object' };
  const d = raw as Record<string, unknown>;
  if (d.app !== BACKUP_APP) return { ok: false, error: 'Not a workout-tracker backup file' };
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported schema version ${String(d.schemaVersion)}` };
  }
  for (const key of TABLE_KEYS) {
    if (!Array.isArray(d[key])) return { ok: false, error: `Missing or invalid "${key}"` };
  }
  for (const row of d.exercises as unknown[]) {
    const e = row as Record<string, unknown>;
    if (typeof e.name !== 'string' || !EXERCISE_TYPES.includes(e.type as string)) {
      return { ok: false, error: 'Invalid exercise entry' };
    }
  }
  for (const row of d.setLogs as unknown[]) {
    const l = row as Record<string, unknown>;
    if (typeof l.sessionId !== 'number' || typeof l.exerciseId !== 'number') {
      return { ok: false, error: 'Invalid set log entry' };
    }
  }
  for (const row of d.sessions as unknown[]) {
    const s = row as Record<string, unknown>;
    if (typeof s.routineId !== 'number' || typeof s.startedAt !== 'number') {
      return { ok: false, error: 'Invalid session entry' };
    }
  }
  return { ok: true, data: raw as BackupFile };
}

export async function importBackup(backup: BackupFile): Promise<void> {
  await db.transaction(
    'rw',
    [db.exercises, db.routines, db.routineExercises, db.sessions, db.setLogs, db.settings],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.routines.clear(),
        db.routineExercises.clear(),
        db.sessions.clear(),
        db.setLogs.clear(),
        db.settings.clear(),
      ]);
      await db.exercises.bulkAdd(backup.exercises);
      await db.routines.bulkAdd(backup.routines);
      await db.routineExercises.bulkAdd(backup.routineExercises);
      await db.sessions.bulkAdd(backup.sessions);
      await db.setLogs.bulkAdd(backup.setLogs);
      await db.settings.bulkAdd(backup.settings);
    },
  );
}
