// Affiche le texte d'un PDF ligne par ligne (positions PDF.js), pour analyser
// la structure des manifestes / BL avant d'écrire les règles d'extraction.
// Usage : node scripts/dump-pdf-text.mjs "samples/pdf/fichier.pdf" [--xy]
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const [, , path, flag] = process.argv;
const data = new Uint8Array(readFileSync(path));
const doc = await getDocument({ data, isEvalSupported: false }).promise;
console.log(`# ${path} — ${doc.numPages} page(s)`);

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const { items } = await page.getTextContent();
  const rows = [];
  for (const it of items) {
    if (!('str' in it) || !it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
    if (!row) rows.push((row = { y, cells: [] }));
    row.cells.push({ x, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  console.log(`\n--- PAGE ${p} (${items.length} items) ---`);
  for (const r of rows) {
    r.cells.sort((a, b) => a.x - b.x);
    console.log(
      flag === '--xy'
        ? `[${r.y.toFixed(0)}] ` + r.cells.map((c) => `${c.x.toFixed(0)}:${c.s}`).join(' | ')
        : r.cells.map((c) => c.s).join(' | ')
    );
  }
}
