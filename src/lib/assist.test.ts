import { describe, expect, it } from 'vitest';
import { acceptLoadInput, parseLoad, splitSign } from './assist';

describe('parseLoad', () => {
  it('reads a plain magnitude as added weight', () => {
    expect(parseLoad('25', 1, 'bodyweight')).toEqual({ ok: true, value: 25 });
  });

  it('reads a magnitude under a negative sign as assistance', () => {
    expect(parseLoad('40', -1, 'bodyweight')).toEqual({ ok: true, value: -40 });
  });

  it('leaves the weight off a bodyweight set when the field is empty', () => {
    expect(parseLoad('', 1, 'bodyweight')).toEqual({ ok: true, value: undefined });
  });

  it('insists on a weight for a weighted exercise', () => {
    expect(parseLoad('', 1, 'weighted')).toEqual({ ok: false, error: 'Enter a weight' });
  });

  it('rejects a magnitude that is not a number', () => {
    expect(parseLoad('heavy', 1, 'weighted')).toEqual({
      ok: false,
      error: 'Weight must be a number',
    });
  });

  it('refuses assistance on a weighted exercise, where a minus is always a typo', () => {
    expect(parseLoad('40', -1, 'weighted')).toEqual({
      ok: false,
      error: 'Only bodyweight exercises can be assisted',
    });
  });

  it('refuses assistance on a timed exercise', () => {
    expect(parseLoad('40', -1, 'timed')).toEqual({
      ok: false,
      error: 'Only bodyweight exercises can be assisted',
    });
  });

  it('reads zero under a negative sign as plain zero, not negative zero', () => {
    const parsed = parseLoad('0', -1, 'bodyweight');
    expect(parsed).toEqual({ ok: true, value: 0 });
    // -0 would survive toEqual above but read back as "-0" everywhere it is shown.
    expect(parsed.ok && Object.is(parsed.value, 0)).toBe(true);
  });
});

describe('splitSign', () => {
  it('splits assistance into a negative toggle and a positive field', () => {
    expect(splitSign(-40)).toEqual({ sign: -1, magnitude: '40' });
  });

  it('leaves added weight positive', () => {
    expect(splitSign(25)).toEqual({ sign: 1, magnitude: '25' });
  });

  it('starts blank and positive when there is no weight to carry over', () => {
    expect(splitSign(undefined)).toEqual({ sign: 1, magnitude: '' });
  });

  it('keeps a fractional magnitude intact', () => {
    expect(splitSign(-2.5)).toEqual({ sign: -1, magnitude: '2.5' });
  });
});

describe('acceptLoadInput', () => {
  it('moves a typed minus onto the toggle instead of into the field', () => {
    expect(acceptLoadInput('-40', 1, 'bodyweight')).toEqual({ magnitude: '40', sign: -1 });
  });

  it('leaves a plain magnitude and the current sign alone', () => {
    expect(acceptLoadInput('40', -1, 'bodyweight')).toEqual({ magnitude: '40', sign: -1 });
  });

  it('keeps the toggle when the field is cleared', () => {
    expect(acceptLoadInput('', -1, 'bodyweight')).toEqual({ magnitude: '', sign: -1 });
  });

  it('lets a second typed minus flip back to added weight', () => {
    expect(acceptLoadInput('-40', -1, 'bodyweight')).toEqual({ magnitude: '40', sign: 1 });
  });

  it('leaves a typed minus in the field where there is no toggle to move it to', () => {
    // A weighted exercise shows no sign button, so hiding the minus would leave
    // the field reading 135 while the set refuses to log. parseLoad rejects it
    // instead, against a field that still shows what was typed.
    expect(acceptLoadInput('-135', 1, 'weighted')).toEqual({ magnitude: '-135', sign: 1 });
  });

  it('leaves a typed minus in the field on a timed exercise too', () => {
    expect(acceptLoadInput('-50', 1, 'timed')).toEqual({ magnitude: '-50', sign: 1 });
  });
});
