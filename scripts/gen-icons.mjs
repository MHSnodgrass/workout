import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('public', { recursive: true });

const BG = '#111418';
const MARK = '#4f8ef7';

/**
 * The app mark: a loaded barbell, viewed end-on down the bar.
 *
 * Two cuts of the same drawing rather than one scaled drawing. At 16px the
 * full five-line version collapses into a smudge — the plate gaps land under a
 * pixel — so the small cut drops to one plate a side and thickens everything
 * that survives. Same mark, drawn for the size it will actually be seen at.
 */
function barbell({ plates, bar, plate }) {
  const lines = plates
    .map(
      ([x, half]) =>
        `<line x1="${x}" y1="${50 - half}" x2="${x}" y2="${50 + half}" stroke-width="${plate}"/>`,
    )
    .join('\n      ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="20" fill="${BG}"/>
    <g stroke="${MARK}" stroke-linecap="round">
      <line x1="22" y1="50" x2="78" y2="50" stroke-width="${bar}"/>
      ${lines}
    </g>
  </svg>`;
}

const large = barbell({
  bar: 8,
  plate: 8,
  plates: [
    [28, 16],
    [38, 24],
    [62, 24],
    [72, 16],
  ],
});

// Short, fat plates on purpose. Tall thin ones plus a crossbar stop reading as
// a dumbbell at 16px and start reading as a capital H — the weights have to be
// blockier than the bar, not just longer.
const small = barbell({
  bar: 12,
  plate: 24,
  plates: [
    [30, 14],
    [70, 14],
  ],
});

// Home-screen and install icons, plus the iOS one — Safari requests
// apple-touch-icon.png whether or not anything links to it.
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  await sharp(Buffer.from(large)).resize(size, size).png().toFile(`public/${name}`);
  console.log(`public/${name}`);
}

// The browser tab. SVG so it stays sharp at any density, with a 32px PNG for
// anything that won't take one. No .ico: this deploys under /workout/, so a
// root /favicon.ico could never be served from here anyway — the <link> tags
// in index.html are what actually stop the browser looking for one.
await writeFile('public/favicon.svg', `${small}\n`, 'utf8');
console.log('public/favicon.svg');
await sharp(Buffer.from(small)).resize(32, 32).png().toFile('public/favicon-32.png');
console.log('public/favicon-32.png');
