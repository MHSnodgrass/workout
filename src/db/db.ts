import Dexie, { type Table } from 'dexie';

export type ExerciseType = 'weighted' | 'bodyweight' | 'timed';

export interface Exercise {
  id?: number;
  name: string;
  type: ExerciseType;
  defaultRestSeconds: number;
  archived: 0 | 1;
}

export interface Routine {
  id?: number;
  name: string;
  archived: 0 | 1;
}

export interface RoutineExercise {
  id?: number;
  routineId: number;
  exerciseId: number;
  order: number;
  targetSets: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  targetDurationSeconds?: number;
}

export interface Session {
  id?: number;
  routineId: number;
  startedAt: number;
  finishedAt: number | null;
  note?: string;
}

export interface SetLog {
  id?: number;
  sessionId: number;
  exerciseId: number;
  setNumber: number;
  weightLbs?: number;
  reps?: number;
  durationSeconds?: number;
  loggedAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, number>;
  routines!: Table<Routine, number>;
  routineExercises!: Table<RoutineExercise, number>;
  sessions!: Table<Session, number>;
  setLogs!: Table<SetLog, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('workout-db');
    // finishedAt is deliberately not indexed: IndexedDB cannot index null,
    // and the active-session lookup filters in memory instead.
    this.version(1).stores({
      exercises: '++id, name, archived',
      routines: '++id, archived',
      routineExercises: '++id, routineId, exerciseId',
      sessions: '++id, routineId, startedAt',
      setLogs: '++id, sessionId, exerciseId',
      settings: 'key',
    });
  }
}

export const db = new WorkoutDB();
