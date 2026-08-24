import { describe, expect, it } from 'vitest';
import { formatDuration, formatSet, round1, targetLabel } from './format';

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
});

describe('round1', () => {
  it('rounds to one decimal', () => {
    expect(round1(180.04)).toBe(180);
    expect(round1(262.55)).toBe(262.6);
  });
});
