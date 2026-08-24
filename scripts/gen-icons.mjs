import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('public', { recursive: true });

const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="20" fill="#111418"/>
    <g stroke="#4f8ef7" stroke-width="8" stroke-linecap="round">
      <line x1="22" y1="50" x2="78" y2="50"/>
      <line x1="28" y1="34" x2="28" y2="66"/>
      <line x1="38" y1="26" x2="38" y2="74"/>
      <line x1="72" y1="34" x2="72" y2="66"/>
      <line x1="62" y1="26" x2="62" y2="74"/>
    </g>
  </svg>`,
);

for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icon-${size}.png`);
  console.log(`public/icon-${size}.png`);
}
