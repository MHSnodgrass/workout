import Dexie, { type Table } from 'dexie';

export type ExerciseType = 'weighted' | 'bodyweight' | 'timed';

export interface Exercise {
  id?: number;
  name: string;
  type: ExerciseType;
  defaultRestSeconds: number;
  archived: 0 | 1;
  /** Weight step for progression suggestions; falls back to the global default. */
  incrementLbs?: number;
  /** Values from MUSCLE_GROUPS in lib/muscles.ts. Untagged means uncounted. */
  muscleGroups?: string[];
  /**
   * The bar this loads onto. Present means "barbell lift" — which is what
   * unlocks the plate breakdown and the warm-up ramp — and absent means there
   * is no bar to break down. See lib/plates.ts.
   */
  barLbs?: number;
}

export interface Routine {
  id?: number;
  name: string;
  archived: 0 | 1;
  /** Days this routine is meant for, 0 = Sunday. A hint; see lib/schedule.ts. */
  weekdays?: number[];
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
  /**
   * Shared id marking a superset. Members must be adjacent in `order` — see
   * lib/supersets.ts, which owns every rule about them.
   */
  supersetGroup?: number;
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
  /** Reps left in reserve. Optional and off by default; see lib/effort.ts. */
  rir?: number;
  loggedAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface BodyWeight {
  id?: number;
  /** When it was weighed. At most one reading per local day; see db/bodyWeights.ts. */
  at: number;
  weightLbs: number;
}

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, number>;
  routines!: Table<Routine, number>;
  routineExercises!: Table<RoutineExercise, number>;
  sessions!: Table<Session, number>;
  setLogs!: Table<SetLog, number>;
  settings!: Table<Setting, string>;
  bodyWeights!: Table<BodyWeight, number>;

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
    // Dexie carries the untouched stores forward, so only the new one is
    // listed. SetLog.rir arrived in the same release and needs no migration —
    // it is an optional, unindexed field.
    this.version(2).stores({ bodyWeights: '++id, at' });
  }
}

export const db = new WorkoutDB();
