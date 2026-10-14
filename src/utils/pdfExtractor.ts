/**
 * Import des manifestes et connaissements PDF.
 *
 * 1. Texte positionné de chaque page : texte natif (PDF.js) ou, pour une page scannée,
 *    OCR Tesseract qui produit les mêmes fragments positionnés.
 * 2. Reconnaissance du format puis lecteur dédié :
 *    - « CARGO MANIFEST » BOCS (plusieurs BL)          → utils/pdf/cargoManifest.ts
 *    - BL BIMCO « CONLINEBILL 2000 », natif ou scanné  → utils/pdf/bimcoBl.ts
 * Aucune valeur n'est inventée : un champ non lu reste vide et figure dans `aVerifier`.
 */
import { parseCargoManifest, isCargoManifest } from './pdf/cargoManifest.ts';
import { parseBimcoBl, isBimcoBl } from './pdf/bimcoBl.ts';
import { isScannedPage, readNativePages } from './pdf/pdfText.ts';
import { ocrPage, type OcrWorker } from './pdf/ocr.ts';
import { groupRows, rowText, type PdfPage } from './pdf/layout.ts';
import type { ParsedBl, ReviewFlag, SourceFormat } from './pdf/types.ts';

export type { ParsedBl, ReviewFlag, SourceFormat };
export { parseMaritimeNumber } from './pdf/layout.ts';

export interface ExtractedBlItem extends ParsedBl {
  fileId: string;
  fileName: string;
  fileSize: number;
  status: 'PENDING' | 'EXTRACTING' | 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  rawText?: string;
  wasOcr?: boolean;
}

export interface PdfExtractionResult {
  bls: ParsedBl[];
  format?: SourceFormat;
  wasOcr: boolean;
  /** Texte lu, ligne par ligne, pour consultation en cas de doute. */
  rawText: string;
}

// PDF.js (~1 Mo) et Tesseract ne servent qu'à l'import de documents : ils sont
// chargés au premier PDF traité, pas au démarrage de l'application.
type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      return pdfjsLib;
    });
  }
  return pdfjsPromise;
}

/** Résolution de rendu des pages scannées pour l'OCR (4 × 72 dpi ≈ 290 dpi, celle des scans reçus). */
const OCR_SCALE = 4;
const MAX_OCR_PAGES = 10;

/** Format reconnu et lecteur correspondant. */
export function parsePositionedPages(pages: PdfPage[], wasOcr: boolean): { bls: ParsedBl[]; format?: SourceFormat } {
  if (isCargoManifest(pages)) return { bls: parseCargoManifest(pages, wasOcr), format: 'MANIFESTE_BOCS' };
  if (isBimcoBl(pages)) return { bls: parseBimcoBl(pages, wasOcr), format: 'BL_BIMCO' };
  return { bls: [] };
}

export const pagesToText = (pages: PdfPage[]) =>
  pages
    .map((p) => `--- PAGE ${p.page} ---\n` + groupRows(p.items, 3).map((r) => rowText(r.items)).join('\n'))
    .join('\n\n');

/**
 * Lit un PDF (manifeste ou BL) et renvoie les connaissements trouvés.
 * `onProgress` reçoit un message court pendant l'OCR, qui prend ~10 s par page.
 */
export async function extractBlsFromPdf(file: File, onProgress?: (message: string) => void): Promise<PdfExtractionResult> {
  const pdfjsLib = await loadPdfJs();
  const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), useSystemFonts: true, isEvalSupported: false }).promise;
  const pages = await readNativePages(doc);

  const scanned = pages.filter(isScannedPage).slice(0, MAX_OCR_PAGES);
  let worker: (OcrWorker & { terminate(): Promise<unknown> }) | null = null;
  try {
    for (const p of scanned) {
      onProgress?.(`OCR page ${p.page}/${pages.length}…`);
      if (!worker) {
        const { createWorker } = await import('tesseract.js');
        worker = (await createWorker('eng')) as unknown as OcrWorker & { terminate(): Promise<unknown> };
      }
      const page = await doc.getPage(p.page);
      const viewport = page.getViewport({ scale: OCR_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      // intent « print » : rendu sans requestAnimationFrame, qui se fige quand l'onglet
      // passe en arrière-plan pendant une OCR longue.
      await page.render({ canvasContext: ctx, viewport, canvas, intent: 'print' }).promise;
      const ocr = await ocrPage(worker, canvas, p.page, p.width, p.height, OCR_SCALE);
      pages[p.page - 1] = ocr;
    }
  } finally {
    await worker?.terminate();
  }

  const wasOcr = scanned.length > 0;
  const { bls, format } = parsePositionedPages(pages, wasOcr);
  return { bls, format, wasOcr, rawText: pagesToText(pages) };
}
