/**
 * Accent colors for the (deliberately dark) UI.
 *
 * Each accent carries its own `ink` — the color painted on top of it for
 * button labels and the finished rest bar. Assuming white would leave the
 * lighter accents washed out, so the pairing travels with the color.
 *
 * Red is absent on purpose: it is already the destructive color, and an
 * accent that matches the delete buttons blunts the warning.
 */

export interface Accent {
  id: string;
  label: string;
  value: string;
  ink: string;
}

const DARK_INK = '#111418';

export const ACCENTS: Accent[] = [
  { id: 'blue', label: 'Blue', value: '#4f8ef7', ink: '#ffffff' },
  { id: 'violet', label: 'Violet', value: '#a371f7', ink: '#ffffff' },
  { id: 'green', label: 'Green', value: '#3fb950', ink: DARK_INK },
  { id: 'amber', label: 'Amber', value: '#e3a008', ink: DARK_INK },
  { id: 'cyan', label: 'Cyan', value: '#39c5cf', ink: DARK_INK },
  { id: 'pink', label: 'Pink', value: '#f778ba', ink: DARK_INK },
];

export const DEFAULT_ACCENT_ID = 'blue';

export function resolveAccent(id: string | undefined): Accent {
  return (
    ACCENTS.find((a) => a.id === id) ?? ACCENTS.find((a) => a.id === DEFAULT_ACCENT_ID) ?? ACCENTS[0]
  );
}

export function applyAccent(accent: Accent, root: HTMLElement): void {
  root.style.setProperty('--accent', accent.value);
  root.style.setProperty('--accent-ink', accent.ink);
}
