import { describe, expect, it } from 'vitest';
import { ACCENTS, DEFAULT_ACCENT_ID, resolveAccent } from './theme';

describe('resolveAccent', () => {
  it('finds an accent by id', () => {
    expect(resolveAccent('green').id).toBe('green');
  });

  it('falls back to the default for an unknown id', () => {
    expect(resolveAccent('chartreuse').id).toBe(DEFAULT_ACCENT_ID);
  });

  it('falls back to the default when nothing is stored', () => {
    expect(resolveAccent(undefined).id).toBe(DEFAULT_ACCENT_ID);
  });
});

describe('ACCENTS', () => {
  it('keeps blue as the default, so existing installs look unchanged', () => {
    expect(resolveAccent(DEFAULT_ACCENT_ID).value).toBe('#4f8ef7');
  });

  it('offers six choices with unique ids', () => {
    expect(ACCENTS).toHaveLength(6);
    expect(new Set(ACCENTS.map((a) => a.id)).size).toBe(6);
  });

  it('pairs every accent with ink that is readable on it', () => {
    // Buttons and the finished rest bar paint `ink` on top of `value`; anything
    // under 3:1 would leave button labels washed out on the lighter accents.
    for (const accent of ACCENTS) {
      expect(contrast(accent.value, accent.ink)).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every accent readable as text on the app background', () => {
    // The progression hint renders in the accent color at 13px.
    for (const accent of ACCENTS) {
      expect(contrast(accent.value, '#111418')).toBeGreaterThanOrEqual(4.5);
    }
  });
});

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
