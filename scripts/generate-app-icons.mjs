// Icônes de l'application installable (public/icons/*.png), dessinées à partir du
// logo BOCS : lettrage blanc et barre verte sur l'encre marine de la marque.
//
// Lancer : node scripts/generate-app-icons.mjs
// Le rendu passe par le Chromium de Playwright et la police « Arial Black » du
// poste (celle du logo à l'écran) : à relancer sous Windows pour un tracé identique.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/icons');
const INK = '#002B49';
const GREEN = '#17B07A';

/**
 * @param {{ size: number, radius: number, scale: number }} options
 *   radius : arrondi du fond, en unités d'une grille de 512 (0 = fond plein bord) ;
 *   scale  : taille du motif (1 = pleine largeur utile, 0.8 = zone sûre d'une icône « maskable »).
 */
const svg = ({ size, radius, scale }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${INK}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <text x="262" y="262" text-anchor="middle" font-family="'Arial Black', Arial, sans-serif"
      font-weight="900" font-style="italic" font-size="128" letter-spacing="-5" fill="#ffffff">BOCS</text>
    <polygon points="70,288 442,288 394,348 362,348 398,308 70,308" fill="${GREEN}"/>
  </g>
</svg>`;

const ICONS = [
  { file: 'icon-192.png', size: 192, radius: 112, scale: 1 },
  { file: 'icon-512.png', size: 512, radius: 112, scale: 1 },
  // « maskable » : Android rogne le fond en cercle ou en carré arrondi ; le motif tient dans la zone sûre.
  { file: 'icon-maskable-512.png', size: 512, radius: 0, scale: 0.78 },
  // iOS arrondit lui-même et n'accepte pas la transparence : fond plein bord.
  { file: 'apple-touch-icon.png', size: 180, radius: 0, scale: 0.9 },
  { file: 'favicon-48.png', size: 48, radius: 96, scale: 1.08 },
  { file: 'favicon-32.png', size: 32, radius: 96, scale: 1.08 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
for (const icon of ICONS) {
  const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;background:transparent">${svg(icon)}</body>`);
  await page.screenshot({ path: path.join(OUT, icon.file), omitBackground: true });
  await page.close();
  console.log(icon.file, `${icon.size}×${icon.size}`);
}
await browser.close();
