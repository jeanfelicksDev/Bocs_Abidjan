// Extrait le scan de chaque page d'un PDF en PNG, pour l'inspecter.
// Usage : node scripts/pdf-page-images.mjs "samples/pdf/scan.pdf" [outDir]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pageScanImage } from '../tests/helpers/pdfImages.mjs';

const [, , path, outDir = 'tmp-pdf-images'] = process.argv;
mkdirSync(outDir, { recursive: true });
const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), isEvalSupported: false }).promise;
for (let p = 1; p <= doc.numPages; p++) {
  const img = await pageScanImage(await doc.getPage(p));
  if (!img) continue;
  writeFileSync(`${outDir}/page${p}.png`, img.png);
  console.log(`${outDir}/page${p}.png`, img.width, 'x', img.height);
}
