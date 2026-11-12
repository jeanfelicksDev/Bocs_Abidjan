import type { PdfPage, TextItem } from './layout.ts';

/** Sous-ensemble de l'API PDF.js utilisé ici (navigateur comme Node). */
interface PdfJsDocument {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(o: { scale: number }): { width: number; height: number };
    getTextContent(): Promise<{ items: object[] }>;
  }>;
}

/** Texte natif positionné de chaque page (y mesuré depuis le haut). */
export async function readNativePages(doc: PdfJsDocument): Promise<PdfPage[]> {
  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { width, height } = page.getViewport({ scale: 1 });
    const { items } = await page.getTextContent();
    const out: TextItem[] = [];
    for (const raw of items) {
      const it = raw as { str?: string; transform?: number[] };
      if (!it.str || !it.str.trim() || !it.transform) continue;
      out.push({ page: n, x: it.transform[4], y: height - it.transform[5], str: it.str });
    }
    pages.push({ page: n, width, height, items: out });
  }
  return pages;
}

/** Une page est « scannée » quand elle ne porte quasiment pas de texte natif. */
export const isScannedPage = (p: PdfPage) => p.items.map((i) => i.str).join('').replace(/\s+/g, '').length < 50;
