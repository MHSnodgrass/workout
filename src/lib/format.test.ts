import { describe, expect, it } from 'vitest';
import {
  elapsedSeconds,
  formatClock,
  formatDuration,
  formatSet,
  round1,
  targetLabel,
} from './format';

describe('elapsedSeconds', () => {
  it('counts whole seconds since the start', () => {
    expect(elapsedSeconds(1000, 1000)).toBe(0);
    expect(elapsedSeconds(1000, 24_600)).toBe(23);
  });

  it('floors, so the logged value matches the running display', () => {
    expect(elapsedSeconds(0, 23_999)).toBe(23);
  });

  it('never goes negative if the clock jumps backwards', () => {
    expect(elapsedSeconds(5000, 1000)).toBe(0);
  });
});

describe('formatClock', () => {
  it('formats seconds as M:SS', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(125)).toBe('2:05');
  });

  it('does not wrap past an hour', () => {
    expect(formatClock(3725)).toBe('62:05');
  });

  it('clamps negatives to zero', () => {
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(130)).toBe('2m 10s');
    expect(formatDuration(3900)).toBe('1h 5m');
  });
});

describe('formatSet', () => {
  const base = { sessionId: 1, exerciseId: 1, setNumber: 1, loggedAt: 0 };
  it('formats each exercise type', () => {
    expect(formatSet({ ...base, weightLbs: 135, reps: 10 }, 'weighted')).toBe('135×10');
    expect(formatSet({ ...base, reps: 12 }, 'bodyweight')).toBe('12');
    expect(formatSet({ ...base, weightLbs: 25, reps: 8 }, 'bodyweight')).toBe('+25×8');
    expect(formatSet({ ...base, durationSeconds: 60 }, 'timed')).toBe('60s');
    expect(formatSet({ ...base, durationSeconds: 60, weightLbs: 50 }, 'timed')).toBe('60s @ 50 lb');
  });

  it('leaves effort out of the sentence form', () => {
    // SetValue renders RIR as its own column. Repeating it here turned the
    // joined "Last: …" line into 155×12 · 1 RIR, 155×12 · 0 RIR, … which is
    // unreadable at a glance — the exact moment that line has to be read.
    expect(formatSet({ ...base, weightLbs: 135, reps: 10, rir: 2 }, 'weighted')).toBe('135×10');
  });
});

describe('targetLabel', () => {
  it('formats rep-range and timed targets', () => {
    expect(
      targetLabel(
        { routineId: 1, exerciseId: 1, order: 1, targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
        'weighted',
      ),
    ).toBe('3 × 8–12');
    expect(
      targetLabel(
        { routineId: 1, exerciseId: 1, order: 1, targetSets: 3, targetDurationSeconds: 60 },
        'timed',
      ),
    ).toBe('3 × 60s');
  });

  it('collapses a fixed rep target instead of printing a range of one', () => {
    expect(
      targetLabel(
        { routineId: 1, exerciseId: 1, order: 1, targetSets: 3, targetRepsMin: 5, targetRepsMax: 5 },
        'weighted',
      ),
    ).toBe('3 × 5');
  });
});

describe('round1', () => {
  it('rounds to one decimal', () => {
    expect(round1(180.04)).toBe(180);
    expect(round1(262.55)).toBe(262.6);
  });
});
