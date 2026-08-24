import { describe, expect, it } from 'vitest';
import { formatRir, parseRir } from './effort';

describe('parseRir', () => {
  it('treats blank as not recorded', () => {
    expect(parseRir('')).toEqual({ ok: true, value: undefined });
    expect(parseRir('   ')).toEqual({ ok: true, value: undefined });
  });

  it('accepts whole numbers across the range', () => {
    expect(parseRir('0')).toEqual({ ok: true, value: 0 });
    expect(parseRir('3')).toEqual({ ok: true, value: 3 });
    expect(parseRir('10')).toEqual({ ok: true, value: 10 });
  });

  it('rejects values outside the range', () => {
    expect(parseRir('-1').ok).toBe(false);
    expect(parseRir('11').ok).toBe(false);
  });

  it('rejects fractions — this is a one-digit field on a phone', () => {
    expect(parseRir('2.5').ok).toBe(false);
  });

  it('rejects anything that is not a number', () => {
    expect(parseRir('hard').ok).toBe(false);
  });
});

describe('formatRir', () => {
  it('renders nothing when effort was not recorded', () => {
    expect(formatRir(undefined)).toBe('');
  });

  it('labels the reserve', () => {
    expect(formatRir(2)).toBe('2 RIR');
  });

  it('renders zero — nothing left in the tank is the whole point', () => {
    expect(formatRir(0)).toBe('0 RIR');
  });
});
