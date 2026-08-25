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
    expect(suggestNext([], target(), exercise('weighted'), 5)).toBeNull();
  });

  it('says nothing when fewer sets were logged than the target', () => {
    const last = weighted([
      [135, 12],
      [135, 12],
    ]);
    expect(suggestNext([last], target({ targetSets: 3 }), exercise('weighted'), 5)).toBeNull();
  });

  it('says nothing when the routine has no rep range to progress against', () => {
    const last = weighted([
      [135, 12],
      [135, 12],
      [135, 12],
    ]);
    const noRange = target({ targetRepsMin: undefined, targetRepsMax: undefined });
    expect(suggestNext([last], noRange, exercise('weighted'), 5)).toBeNull();
  });

  it('says nothing when a weighted set was logged without a weight', () => {
    const last = lastTime([
      { weightLbs: 135, reps: 12 },
      { reps: 12 },
      { weightLbs: 135, reps: 12 },
    ]);
    expect(suggestNext([last], target(), exercise('weighted'), 5)).toBeNull();
  });
});

describe('suggestNext — weighted', () => {
  it('adds the increment when every target set hit the top of the range', () => {
    const last = weighted([
      [135, 12],
      [135, 12],
      [135, 12],
    ]);

    const s = suggestNext([last], target(), exercise('weighted'), 5);

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

    const s = suggestNext([last], target(), exercise('weighted'), 5);

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

    expect(suggestNext([last], target(), exercise('weighted'), 2.5)?.weightLbs).toBe(47.5);
  });

  it('treats the lightest working set as the weight to beat, so a ramp stays conservative', () => {
    const last = weighted([
      [135, 12],
      [145, 12],
      [155, 12],
    ]);

    expect(suggestNext([last], target(), exercise('weighted'), 5)?.weightLbs).toBe(140);
  });

  it('ignores sets logged beyond the target count', () => {
    const last = weighted([
      [135, 12],
      [135, 12],
      [135, 12],
      [135, 6],
    ]);

    expect(suggestNext([last], target({ targetSets: 3 }), exercise('weighted'), 5)?.weightLbs).toBe(
      140,
    );
  });

  it('counts reps above the top of the range as hitting it', () => {
    const last = weighted([
      [135, 15],
      [135, 13],
      [135, 12],
    ]);

    expect(suggestNext([last], target(), exercise('weighted'), 5)?.weightLbs).toBe(140);
  });
});

describe('suggestNext — bodyweight', () => {
  it('suggests another set once the rep ceiling is hit on every set', () => {
    const last = lastTime([{ reps: 20 }, { reps: 20 }, { reps: 20 }]);
    const re = target({ targetRepsMax: 20 });

    const s = suggestNext([last], re, exercise('bodyweight'), 5);

    expect(s).toEqual({
      addSet: true,
      reps: 20,
      note: 'You hit 3×20 — try a 4th set',
    });
  });

  it('asks for more reps before adding a set', () => {
    const last = lastTime([{ reps: 20 }, { reps: 18 }, { reps: 15 }]);
    const re = target({ targetRepsMax: 20 });

    const s = suggestNext([last], re, exercise('bodyweight'), 5);

    expect(s).toEqual({ reps: 20, note: 'Aim for 3×20' });
  });

  it('never suggests weight, even when sets were logged with added weight', () => {
    const last = lastTime([
      { reps: 20, weightLbs: 25 },
      { reps: 20, weightLbs: 25 },
      { reps: 20, weightLbs: 25 },
    ]);

    expect(suggestNext([last], target({ targetRepsMax: 20 }), exercise('bodyweight'), 5)?.weightLbs)
      .toBeUndefined();
  });
});

describe('suggestNext — assisted bodyweight', () => {
  /** The starter program's pull-up: 3 sets of 4–6, one 10 lb machine pin. */
  const pullup = target({ targetRepsMin: 4, targetRepsMax: 6 });
  const assisted = (sets: Array<[number, number]>) =>
    lastTime(sets.map(([weightLbs, reps]) => ({ weightLbs, reps })));

  it('takes a pin off the stack once every target set hit the top of the range', () => {
    const last = assisted([
      [-40, 6],
      [-40, 6],
      [-40, 6],
    ]);

    const s = suggestNext([last], pullup, exercise('bodyweight'), 10);

    expect(s).toEqual({
      weightLbs: -30,
      reps: 4,
      note: 'Try 30 lb assist — you hit 3×6 last time',
    });
  });

  it('holds the assistance when a set came up short', () => {
    const last = assisted([
      [-40, 6],
      [-40, 6],
      [-40, 4],
    ]);

    const s = suggestNext([last], pullup, exercise('bodyweight'), 10);

    expect(s).toEqual({
      weightLbs: -40,
      reps: 6,
      note: 'Stay at 40 lb assist — aim for 3×6',
    });
  });

  it('treats the heaviest assistance as the load to beat, so a ramp stays honest', () => {
    const last = assisted([
      [-40, 6],
      [-30, 6],
      [-30, 6],
    ]);

    expect(suggestNext([last], pullup, exercise('bodyweight'), 10)?.weightLbs).toBe(-30);
  });

  it('counts a set logged without a weight as unassisted rather than giving up', () => {
    // Dropping the assist for the last set is a real session, not a data gap —
    // the weighted rule would have refused to suggest anything at all.
    const last = lastTime([
      { weightLbs: -40, reps: 6 },
      { weightLbs: -40, reps: 6 },
      { reps: 6 },
    ]);

    expect(suggestNext([last], pullup, exercise('bodyweight'), 10)?.weightLbs).toBe(-30);
  });

  it('stops at zero rather than suggesting less assistance than none', () => {
    const last = assisted([
      [-5, 6],
      [-5, 6],
      [-5, 6],
    ]);

    const s = suggestNext([last], pullup, exercise('bodyweight'), 10);

    expect(s).toEqual({
      weightLbs: 0,
      reps: 4,
      note: 'Try bodyweight — you hit 3×6 last time',
    });
  });

  it('hands back to the rep rule once the assist is gone', () => {
    const last = assisted([
      [0, 6],
      [0, 6],
      [0, 6],
    ]);

    const s = suggestNext([last], pullup, exercise('bodyweight'), 10);

    expect(s).toEqual({ addSet: true, reps: 6, note: 'You hit 3×6 — try a 4th set' });
  });

  it('leaves added weight on a bodyweight exercise alone', () => {
    const last = assisted([
      [25, 6],
      [25, 6],
      [25, 6],
    ]);

    expect(suggestNext([last], pullup, exercise('bodyweight'), 10)?.weightLbs).toBeUndefined();
  });

  it('gives back a pin after the stall threshold, instead of deloading toward zero', () => {
    const stuck = (id: number) => ({
      session: { id, routineId: 1, startedAt: id * 1_000, finishedAt: id * 1_000 + 500 },
      sets: [6, 6, 4].map((reps, i) => ({
        id: id * 100 + i,
        sessionId: id,
        exerciseId: 1,
        setNumber: i + 1,
        weightLbs: -40,
        reps,
        loggedAt: id * 1_000,
      })),
    });

    const s = suggestNext([stuck(1), stuck(2), stuck(3)], pullup, exercise('bodyweight'), 10, 3);

    expect(s).toEqual({
      weightLbs: -50,
      reps: 4,
      deload: true,
      note: 'Deload to 50 lb assist — 3 sessions stuck at 40 lb assist',
    });
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

    const s = suggestNext([last], timedTarget, exercise('timed'), 5);

    expect(s).toEqual({ durationSeconds: 65, note: 'Try 65s — you held 60s last time' });
  });

  it('holds the target when a set came up short', () => {
    const last = lastTime([
      { durationSeconds: 60 },
      { durationSeconds: 45 },
      { durationSeconds: 60 },
    ]);

    const s = suggestNext([last], timedTarget, exercise('timed'), 5);

    expect(s).toEqual({ durationSeconds: 60, note: 'Aim for 3×60s' });
  });

  it('says nothing without a duration target', () => {
    const last = lastTime([{ durationSeconds: 60 }, { durationSeconds: 60 }]);
    const noTarget = target({ targetSets: 2, targetDurationSeconds: undefined });

    expect(suggestNext([last], noTarget, exercise('timed'), 5)).toBeNull();
  });
});

/** A finished weighted session with its own id, for building real history. */
function session(id: number, sets: Array<[number, number]>): SessionSets {
  return {
    session: { id, routineId: 1, startedAt: id * 1_000, finishedAt: id * 1_000 + 500 },
    sets: sets.map(([weightLbs, reps], i) => ({
      id: id * 100 + i,
      sessionId: id,
      exerciseId: 1,
      setNumber: i + 1,
      weightLbs,
      reps,
      loggedAt: id * 1_000,
    })),
  };
}

const stalledAt = (id: number, w: number) =>
  session(id, [
    [w, 12],
    [w, 12],
    [w, 10],
  ]);

describe('suggestNext — stall detection', () => {
  it('deloads after the threshold of stuck sessions at the same weight', () => {
    const history = [stalledAt(1, 155), stalledAt(2, 155), stalledAt(3, 155)];

    const s = suggestNext(history, target(), exercise('weighted'), 5, 3);

    expect(s).toEqual({
      weightLbs: 140,
      reps: 8,
      deload: true,
      note: 'Deload to 140 lb — 3 sessions stuck at 155 lb',
    });
  });

  it('holds while the stall is still short of the threshold', () => {
    const history = [stalledAt(1, 155), stalledAt(2, 155)];

    expect(suggestNext(history, target(), exercise('weighted'), 5, 3)?.note).toBe(
      'Stay at 155 lb — aim for 3×12',
    );
  });

  it('restarts the count when the working weight changed', () => {
    const history = [stalledAt(1, 155), stalledAt(2, 145), stalledAt(3, 155)];

    expect(suggestNext(history, target(), exercise('weighted'), 5, 3)?.deload).toBeUndefined();
  });

  it('restarts the count after a session that did hit the range', () => {
    const hit = session(4, [
      [155, 12],
      [155, 12],
      [155, 12],
    ]);
    const history = [stalledAt(1, 155), stalledAt(2, 155), hit, stalledAt(5, 155)];

    expect(suggestNext(history, target(), exercise('weighted'), 5, 3)?.deload).toBeUndefined();
  });

  it('rounds the deload to the exercise increment', () => {
    const history = [stalledAt(1, 100), stalledAt(2, 100), stalledAt(3, 100)];

    // 90 lb exactly, and it lands on the 2.5 lb grid either way.
    expect(suggestNext(history, target(), exercise('weighted'), 2.5, 3)?.weightLbs).toBe(90);
  });

  it('holds rather than deloading when there is no lower weight to give', () => {
    const history = [stalledAt(1, 5), stalledAt(2, 5), stalledAt(3, 5)];

    expect(suggestNext(history, target(), exercise('weighted'), 5, 3)?.deload).toBeUndefined();
  });

  it('never deloads bodyweight work — there is nothing to take off', () => {
    const short = (id: number) => ({
      session: { id, routineId: 1, startedAt: id * 1_000, finishedAt: id * 1_000 + 500 },
      sets: [15, 15, 12].map((reps, i) => ({
        id: id * 100 + i,
        sessionId: id,
        exerciseId: 1,
        setNumber: i + 1,
        reps,
        loggedAt: id * 1_000,
      })),
    });
    const history = [short(1), short(2), short(3)];

    const s = suggestNext(history, target({ targetRepsMax: 20 }), exercise('bodyweight'), 5, 3);
    expect(s).toEqual({ reps: 20, note: 'Aim for 3×20' });
  });
});
