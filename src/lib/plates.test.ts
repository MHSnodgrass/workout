import { describe, expect, it } from 'vitest';
import { DEFAULT_BAR_LBS, DEFAULT_PLATES, formatPlates, platesPerSide, snapToLoadable } from './plates';

const PLATES = DEFAULT_PLATES;

describe('platesPerSide', () => {
  it('loads the everyday case largest plate first', () => {
    // 155 = 45 bar + 55 a side.
    expect(platesPerSide(155, 45, PLATES)).toEqual({ perSide: [45, 10], achieved: 155, short: 0 });
  });

  it('handles a bare bar', () => {
    expect(platesPerSide(45, 45, PLATES)).toEqual({ perSide: [], achieved: 45, short: 0 });
  });

  it('repeats a plate when the load calls for it', () => {
    // 225 = 45 bar + 90 a side = two 45s.
    expect(platesPerSide(225, 45, PLATES)).toEqual({ perSide: [45, 45], achieved: 225, short: 0 });
  });

  it('uses fractional plates when they close the gap exactly', () => {
    expect(platesPerSide(100, 45, PLATES)).toEqual({ perSide: [25, 2.5], achieved: 100, short: 0 });
  });

  it('reports what it fell short by rather than pretending', () => {
    // 47.5 needs 1.25 a side and the smallest plate is 2.5.
    expect(platesPerSide(47.5, 45, PLATES)).toEqual({ perSide: [], achieved: 45, short: 2.5 });
  });

  it('returns null below the weight of the bar', () => {
    expect(platesPerSide(40, 45, PLATES)).toBeNull();
  });

  it('respects the plates the gym actually has', () => {
    // No 45s available, so 155 is built from what is on the rack.
    expect(platesPerSide(155, 45, [25, 10, 5])).toEqual({
      perSide: [25, 25, 5],
      achieved: 155,
      short: 0,
    });
  });

  it('does not drift on repeated fractional plates', () => {
    // Four 2.5s a side is where naive floating point starts producing 9.999…
    expect(platesPerSide(65, 45, [2.5])).toEqual({
      perSide: [2.5, 2.5, 2.5, 2.5],
      achieved: 65,
      short: 0,
    });
  });

  it('ignores junk in the plate list', () => {
    expect(platesPerSide(135, 45, [45, 0, -10, 45])).toEqual({
      perSide: [45],
      achieved: 135,
      short: 0,
    });
  });
});

describe('snapToLoadable', () => {
  it('rounds down to something you can actually put on the bar', () => {
    // 55% of 155 is 85.25, and the smallest jump is two 2.5s.
    expect(snapToLoadable(85.25, 45, PLATES)).toBe(85);
  });

  it('never goes below the bar', () => {
    expect(snapToLoadable(20, 45, PLATES)).toBe(45);
  });

  it('leaves an already-loadable weight alone', () => {
    expect(snapToLoadable(135, 45, PLATES)).toBe(135);
  });
});

describe('formatPlates', () => {
  it('reads the way you would say it', () => {
    expect(formatPlates([45, 10, 5])).toBe('45, 10, 5');
  });

  it('collapses repeats into a count', () => {
    expect(formatPlates([45, 45, 25])).toBe('2 × 45, 25');
  });

  it('says so when nothing goes on the bar', () => {
    expect(formatPlates([])).toBe('just the bar');
  });
});

describe('defaults', () => {
  it('ships a standard bar and rack', () => {
    expect(DEFAULT_BAR_LBS).toBe(45);
    expect(DEFAULT_PLATES).toEqual([45, 35, 25, 10, 5, 2.5]);
  });
});
