import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS } from './muscles';
import {
  STARTER_EXERCISES,
  STARTER_ROUTINES,
  installSummary,
  starterExercise,
} from './starterProgram';

const entries = STARTER_ROUTINES.flatMap((r) => r.entries);

describe('the starter program plan', () => {
  it('is three routines on Monday, Wednesday and Friday', () => {
    expect(STARTER_ROUTINES.map((r) => r.weekdays)).toEqual([[1], [3], [5]]);
  });

  it('names an exercise that exists for every entry', () => {
    for (const entry of entries) {
      expect(starterExercise(entry.exercise), entry.exercise).toBeDefined();
    }
  });

  it('has no duplicate exercise names', () => {
    const names = STARTER_EXERCISES.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('leaves nothing in the library unused', () => {
    const used = new Set(entries.map((e) => e.exercise));
    expect(STARTER_EXERCISES.filter((e) => !used.has(e.name))).toEqual([]);
  });
});

describe('supersets', () => {
  // The program pairs its arm work; this install deliberately does not, so the
  // pairs are plain consecutive entries. Guards against one creeping back in.
  it('are absent from every entry', () => {
    for (const entry of entries) {
      expect(Object.keys(entry)).not.toContain('supersetGroup');
    }
  });

  it('still keeps the paired arm work adjacent', () => {
    const monday = STARTER_ROUTINES[0].entries.map((e) => e.exercise);
    expect(monday.indexOf('Rope Pushdown')).toBe(monday.indexOf('EZ-Bar Curl') + 1);
    const friday = STARTER_ROUTINES[2].entries.map((e) => e.exercise);
    expect(friday.indexOf('Overhead Triceps Extension')).toBe(
      friday.indexOf('Incline DB Curl') + 1,
    );
  });
});

describe('rep targets', () => {
  // suggestNext returns null without a ceiling, so an entry missing one would
  // silently lose its progression suggestion for good.
  it('always carry both bounds, low before high', () => {
    for (const entry of entries) {
      expect(entry.targetRepsMin, entry.exercise).toBeGreaterThan(0);
      expect(entry.targetRepsMax, entry.exercise).toBeGreaterThanOrEqual(entry.targetRepsMin);
    }
  });

  it('asks for at least one working set', () => {
    for (const entry of entries) {
      expect(entry.targetSets, entry.exercise).toBeGreaterThan(0);
    }
  });

  it("reads the program's 2x5 + 1x5+ as a flat three by five", () => {
    const squat = STARTER_ROUTINES[0].entries[0];
    expect(squat).toMatchObject({
      exercise: 'Back Squat',
      targetSets: 3,
      targetRepsMin: 5,
      targetRepsMax: 5,
    });
  });
});

describe('exercises that appear twice a week', () => {
  it('splits the two whose jobs differ, so their histories stay apart', () => {
    // Monday's squat is heavy and Friday's is 90% of it; Friday's pull-up is the
    // weighted day. Sharing one exercise would let suggestNext average them.
    expect(starterExercise('Back Squat (Volume)')).toBeDefined();
    expect(starterExercise('Weighted Pull-up')).toBeDefined();
  });

  it('shares bench across both days, which is what makes it +5 a week', () => {
    const days = STARTER_ROUTINES.filter((r) =>
      r.entries.some((e) => e.exercise === 'Bench Press'),
    );
    expect(days).toHaveLength(2);
    expect(starterExercise('Bench Press')?.incrementLbs).toBe(2.5);
  });
});

describe('exercise settings', () => {
  it('tags every exercise with groups the coverage card knows', () => {
    for (const exercise of STARTER_EXERCISES) {
      expect(exercise.muscleGroups.length, exercise.name).toBeGreaterThan(0);
      for (const group of exercise.muscleGroups) {
        expect(MUSCLE_GROUPS, exercise.name).toContain(group);
      }
    }
  });

  it('gives the barbell lifts a bar, and nothing else one', () => {
    const barbell = STARTER_EXERCISES.filter((e) => e.barLbs !== undefined).map((e) => e.name);
    expect(barbell).toEqual([
      'Back Squat',
      'Bench Press',
      'EZ-Bar Curl',
      'Deadlift',
      'Overhead Press',
      'Back Squat (Volume)',
      'Romanian Deadlift',
    ]);
  });

  it("carries the program's own increments on the lifts that state one", () => {
    expect(starterExercise('Back Squat')?.incrementLbs).toBe(5);
    expect(starterExercise('Deadlift')?.incrementLbs).toBe(5);
    expect(starterExercise('Overhead Press')?.incrementLbs).toBe(2.5);
    expect(starterExercise('Weighted Pull-up')?.incrementLbs).toBe(2.5);
    // Accessories inherit the global default rather than guessing at a stack.
    expect(starterExercise('Rope Pushdown')?.incrementLbs).toBeUndefined();
  });

  it('steps the pull-up by a machine pin, so assisted reps have something to progress by', () => {
    expect(starterExercise('Pull-up')?.incrementLbs).toBe(10);
  });

  it('rests longer on the heavy compounds than on the isolation work', () => {
    expect(starterExercise('Deadlift')?.defaultRestSeconds).toBe(210);
    expect(starterExercise('Rope Pushdown')?.defaultRestSeconds).toBe(75);
  });
});

describe('installSummary', () => {
  it('reports what was added', () => {
    expect(installSummary({ routinesAdded: 3, exercisesCreated: 16, exercisesReused: 0 })).toBe(
      'Added 3 routines and 16 exercises',
    );
  });

  it('says when something of yours was reused instead', () => {
    expect(installSummary({ routinesAdded: 3, exercisesCreated: 14, exercisesReused: 2 })).toBe(
      'Added 3 routines and 14 exercises · reused 2 you already had',
    );
  });

  it('speaks English for exactly one of each', () => {
    expect(installSummary({ routinesAdded: 1, exercisesCreated: 1, exercisesReused: 1 })).toBe(
      'Added 1 routine and 1 exercise · reused 1 you already had',
    );
  });

  it('is honest when there was nothing left to add', () => {
    expect(installSummary({ routinesAdded: 0, exercisesCreated: 0, exercisesReused: 0 })).toBe(
      'Already installed — nothing to add',
    );
  });

  it('does not claim exercises when only a routine was rebuilt from yours', () => {
    expect(installSummary({ routinesAdded: 1, exercisesCreated: 0, exercisesReused: 6 })).toBe(
      'Added 1 routine · reused 6 exercises you already had',
    );
  });
});
