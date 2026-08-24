import { describe, expect, it } from 'vitest';
import type { Exercise, ExerciseType, RoutineExercise, SetLog } from '../db/db';
import type { SessionSets } from '../db/queries';
import { suggestNext } from './progression';

function exercise(type: ExerciseType): Exercise {
  return { id: 1, name: 'Lift', type, defaultRestSeconds: 90, archived: 0 };
}

function target(over: Partial<RoutineExercise> = {}): RoutineExercise {
  return {
    id: 1,
    routineId: 1,
    exerciseId: 1,
    order: 1,
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    ...over,
  };
}

/** Builds a finished session from shorthand sets, e.g. [[135, 12], [135, 12]]. */
function lastTime(sets: Array<Partial<SetLog>>): SessionSets {
  return {
    session: { id: 9, routineId: 1, startedAt: 1_000, finishedAt: 2_000 },
    sets: sets.map((s, i) => ({
      id: i + 1,
      sessionId: 9,
      exerciseId: 1,
      setNumber: i + 1,
      loggedAt: 1_000,
      ...s,
    })),
  };
}

const weighted = (sets: Array<[number, number]>) =>
  lastTime(sets.map(([weightLbs, reps]) => ({ weightLbs, reps })));

describe('suggestNext — no suggestion', () => {
  it('says nothing without history', () => {
    expect(suggestNext(null, target(), exercise('weighted'), 5)).toBeNull();
  });

  it('says nothing when fewer sets were logged than the target', () => {
    const last = weighted([
      [135, 12],
      [135, 12],
    ]);
    expect(suggestNext(last, target({ targetSets: 3 }), exercise('weighted'), 5)).toBeNull();
  });

  it('says nothing when the routine has no rep range to progress against', () => {
    const last = weighted([
      [135, 12],
      [135, 12],
      [135, 12],
    ]);
    const noRange = target({ targetRepsMin: undefined, targetRepsMax: undefined });
    expect(suggestNext(last, noRange, exercise('weighted'), 5)).toBeNull();
  });

  it('says nothing when a weighted set was logged without a weight', () => {
    const last = lastTime([
      { weightLbs: 135, reps: 12 },
      { reps: 12 },
      { weightLbs: 135, reps: 12 },
    ]);
    expect(suggestNext(last, target(), exercise('weighted'), 5)).toBeNull();
  });
});

describe('suggestNext — weighted', () => {
  it('adds the increment when every target set hit the top of the range', () => {
    const last = weighted([
      [135, 12],
      [135, 12],
      [135, 12],
    ]);

    const s = suggestNext(last, target(), exercise('weighted'), 5);

    expect(s).toEqual({
      weightLbs: 140,
      reps: 8,
      note: 'Try 140 lb — you hit 3×12 last time',
    });
  });

  it('holds the weight when any target set fell short', () => {
    const last = weighted([
      [135, 12],
      [135, 12],
      [135, 10],
    ]);

    const s = suggestNext(last, target(), exercise('weighted'), 5);

    expect(s).toEqual({
      weightLbs: 135,
      reps: 12,
      note: 'Stay at 135 lb — aim for 3×12',
    });
  });

  it('uses the per-exercise increment it is given', () => {
    const last = weighted([
      [45, 12],
      [45, 12],
      [45, 12],
    ]);

    expect(suggestNext(last, target(), exercise('weighted'), 2.5)?.weightLbs).toBe(47.5);
  });

  it('treats the lightest working set as the weight to beat, so a ramp stays conservative', () => {
    const last = weighted([
      [135, 12],
      [145, 12],
      [155, 12],
    ]);

    expect(suggestNext(last, target(), exercise('weighted'), 5)?.weightLbs).toBe(140);
  });

  it('ignores sets logged beyond the target count', () => {
    const last = weighted([
      [135, 12],
      [135, 12],
      [135, 12],
      [135, 6],
    ]);

    expect(suggestNext(last, target({ targetSets: 3 }), exercise('weighted'), 5)?.weightLbs).toBe(
      140,
    );
  });

  it('counts reps above the top of the range as hitting it', () => {
    const last = weighted([
      [135, 15],
      [135, 13],
      [135, 12],
    ]);

    expect(suggestNext(last, target(), exercise('weighted'), 5)?.weightLbs).toBe(140);
  });
});

describe('suggestNext — bodyweight', () => {
  it('suggests another set once the rep ceiling is hit on every set', () => {
    const last = lastTime([{ reps: 20 }, { reps: 20 }, { reps: 20 }]);
    const re = target({ targetRepsMax: 20 });

    const s = suggestNext(last, re, exercise('bodyweight'), 5);

    expect(s).toEqual({
      addSet: true,
      reps: 20,
      note: 'You hit 3×20 — try a 4th set',
    });
  });

  it('asks for more reps before adding a set', () => {
    const last = lastTime([{ reps: 20 }, { reps: 18 }, { reps: 15 }]);
    const re = target({ targetRepsMax: 20 });

    const s = suggestNext(last, re, exercise('bodyweight'), 5);

    expect(s).toEqual({ reps: 20, note: 'Aim for 3×20' });
  });

  it('never suggests weight, even when sets were logged with added weight', () => {
    const last = lastTime([
      { reps: 20, weightLbs: 25 },
      { reps: 20, weightLbs: 25 },
      { reps: 20, weightLbs: 25 },
    ]);

    expect(suggestNext(last, target({ targetRepsMax: 20 }), exercise('bodyweight'), 5)?.weightLbs)
      .toBeUndefined();
  });
});

describe('suggestNext — timed', () => {
  const timedTarget = target({
    targetRepsMin: undefined,
    targetRepsMax: undefined,
    targetDurationSeconds: 60,
  });

  it('adds five seconds once every set held the target', () => {
    const last = lastTime([
      { durationSeconds: 60 },
      { durationSeconds: 62 },
      { durationSeconds: 60 },
    ]);

    const s = suggestNext(last, timedTarget, exercise('timed'), 5);

    expect(s).toEqual({ durationSeconds: 65, note: 'Try 65s — you held 60s last time' });
  });

  it('holds the target when a set came up short', () => {
    const last = lastTime([
      { durationSeconds: 60 },
      { durationSeconds: 45 },
      { durationSeconds: 60 },
    ]);

    const s = suggestNext(last, timedTarget, exercise('timed'), 5);

    expect(s).toEqual({ durationSeconds: 60, note: 'Aim for 3×60s' });
  });

  it('says nothing without a duration target', () => {
    const last = lastTime([{ durationSeconds: 60 }, { durationSeconds: 60 }]);
    const noTarget = target({ targetSets: 2, targetDurationSeconds: undefined });

    expect(suggestNext(last, noTarget, exercise('timed'), 5)).toBeNull();
  });
});
