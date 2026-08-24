import { describe, expect, it } from 'vitest';
import { DEFAULT_PLATES } from './plates';
import { warmupRamp } from './warmup';

const PLATES = DEFAULT_PLATES;

describe('warmupRamp', () => {
  it('ramps from the bar to just under the working weight', () => {
    const ramp = warmupRamp(225, 45, PLATES);
    expect(ramp[0]).toEqual({ weightLbs: 45, reps: 5 });
    // 55/70/85% of 225 is 123.75 / 157.5 / 191.25, each snapped down to a
    // weight the rack can build.
    expect(ramp.map((s) => s.weightLbs)).toEqual([45, 120, 155, 190]);
    expect(ramp.every((s) => s.weightLbs < 225)).toBe(true);
  });

  it('only suggests weights you can actually load', () => {
    const ramp = warmupRamp(155, 45, PLATES);
    // Every step lands on a real plate combination, never 85.25.
    for (const step of ramp) {
      expect(step.weightLbs).toBe(Math.round(step.weightLbs * 2) / 2);
      expect(step.weightLbs % 5).toBe(0);
    }
  });

  it('drops reps as the weight climbs', () => {
    const reps = warmupRamp(315, 45, PLATES).map((s) => s.reps);
    expect(reps).toEqual([...reps].sort((a, b) => b - a));
  });

  it('collapses to the bar alone when there is nothing to ramp through', () => {
    // Every percentage of 50 lands under the bar, so only the bar survives.
    expect(warmupRamp(50, 45, PLATES)).toEqual([{ weightLbs: 45, reps: 5 }]);
  });

  it('has nothing to say at or below the bar', () => {
    expect(warmupRamp(45, 45, PLATES)).toEqual([]);
    expect(warmupRamp(30, 45, PLATES)).toEqual([]);
  });

  it('never repeats a weight', () => {
    const ramp = warmupRamp(75, 45, PLATES);
    expect(new Set(ramp.map((s) => s.weightLbs)).size).toBe(ramp.length);
  });

  it('follows a lighter bar down', () => {
    const ramp = warmupRamp(95, 25, PLATES);
    expect(ramp[0].weightLbs).toBe(25);
    expect(ramp.every((s) => s.weightLbs < 95)).toBe(true);
  });
});
