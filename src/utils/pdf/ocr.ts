/**
 * OCR d'une page scannée → fragments positionnés (mêmes coordonnées que le texte natif).
 *
 * Indépendant de l'environnement : `image` est un canvas (navigateur) ou un Buffer PNG
 * (tests Node), `pxPerPt` le rapport pixels de l'image / points PDF.
 *
 * Sur un BL BIMCO, les noms des parties sont souvent tamponnés PAR-DESSUS le libellé
 * imprimé (« Consignee (full style and address) »), que l'OCR pleine page avale. Chaque
 * case Shipper / Consignee / Notify est donc relue seule, puis la ligne du libellé est
 * relue juste sous sa ligne médiane pour récupérer le nom, avec sa confiance.
 */
import { ADDRESS_LINE, type PdfPage, type TextItem } from './layout.ts';
import { scaledZone, type BimcoZoneName } from './bimcoBl.ts';

interface Bbox { x0: number; y0: number; x1: number; y1: number }
interface OcrWord { text: string; confidence: number; bbox: Bbox }
interface OcrLine { text: string; confidence: number; bbox: Bbox; words: OcrWord[] }
interface OcrData {
  text: string;
  blocks?: Array<{ paragraphs: Array<{ lines: OcrLine[] }> }> | null;
}

/** Sous-ensemble de l'API d'un worker tesseract.js utilisé ici. */
export interface OcrWorker {
  setParameters(p: Record<string, string>): Promise<unknown>;
  recognize(
    image: unknown,
    options?: { rectangle?: { left: number; top: number; width: number; height: number } },
    output?: { blocks?: boolean; text?: boolean }
  ): Promise<{ data: OcrData }>;
}

const PSM_BLOCK = '6';

const linesOf = (d: OcrData): OcrLine[] =>
  (d.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));

const PARTY_LABEL = /(style|address|order|shipper|consign|notify|party)/i;

export async function ocrPage(
  worker: OcrWorker,
  image: unknown,
  page: number,
  width: number,
  height: number,
  pxPerPt: number
): Promise<PdfPage> {
  await worker.setParameters({ tessedit_pageseg_mode: PSM_BLOCK });
  const { data } = await worker.recognize(image, {}, { blocks: true, text: true });

  let items: TextItem[] = linesOf(data).flatMap((l) =>
    l.words
      // Le filigrane des conditions générales produit des mots de très faible confiance.
      .filter((w) => w.text.trim() && w.confidence >= 30)
      .map((w) => ({ page, x: w.bbox.x0 / pxPerPt, y: w.bbox.y1 / pxPerPt, str: w.text, conf: w.confidence }))
  );

  if (/CONLINEBILL|BIMCO|BILL\s+OF\s+LADING/i.test(data.text) && /Shipper/i.test(data.text)) {
    for (const zone of ['shipper', 'consignee', 'notify'] as BimcoZoneName[]) {
      const [x0, y0, x1, y1] = scaledZone(zone, width, height);
      const refined = await ocrPartyZone(worker, image, page, pxPerPt, [x0, y0, x1, y1]);
      if (!refined.length) continue;
      items = items.filter((i) => !(i.x >= x0 && i.x < x1 && i.y >= y0 && i.y < y1)).concat(refined);
    }
  }
  return { page, width, height, items };
}

async function ocrPartyZone(
  worker: OcrWorker,
  image: unknown,
  page: number,
  s: number,
  [x0, y0, x1, y1]: [number, number, number, number]
): Promise<TextItem[]> {
  const rect = { left: x0 * s, top: y0 * s, width: (x1 - x0) * s, height: (y1 - y0) * s };
  await worker.setParameters({ tessedit_pageseg_mode: PSM_BLOCK });
  const { data } = await worker.recognize(image, { rectangle: rect }, { blocks: true });
  const lines = linesOf(data).filter((l) => l.text.trim());
  if (!lines.length) return [];

  const toItem = (text: string, conf: number, b: Bbox): TextItem => ({
    page,
    x: b.x0 / s,
    y: b.y1 / s,
    str: text.trim(),
    conf,
  });

  const labelIdx = lines.findIndex((l) => PARTY_LABEL.test(l.text));
  const content = lines.slice(labelIdx + 1).map((l) => toItem(l.text, l.confidence, l.bbox));
  // Relecture seulement quand le nom manque : la 1re ligne lue est déjà une adresse.
  if (labelIdx < 0 || (content.length && !ADDRESS_LINE.test(content[0].str))) return content;

  // Nom écrit sur la ligne du libellé : relecture de la moitié basse de cette ligne.
  const lab = lines[labelIdx].bbox;
  const h = lab.y1 - lab.y0;
  const rescue = await worker.recognize(
    image,
    { rectangle: { left: rect.left, top: lab.y0 + 0.65 * h, width: rect.width, height: h } },
    { blocks: true }
  );
  const words = linesOf(rescue.data)[0]?.words || [];
  const name: OcrWord[] = [];
  for (const w of words) {
    const t = w.text.trim();
    if (!name.length && !/[A-Za-z0-9]/.test(t)) continue; // bord de case lu « | » ou « [ »
    // Les valeurs sont en majuscules ; un mot en minuscules ou du bruit termine le nom.
    if (/^[A-Z0-9&.'()\/-]{2,}$/.test(t) && /[A-Z]{2}/.test(t)) name.push(w);
    else break;
  }
  if (name.length) {
    const text = name.map((w) => w.text.replace(/[-.]+$/, '')).join(' ');
    const conf = Math.min(...name.map((w) => w.confidence));
    content.unshift({ page, x: name[0].bbox.x0 / s, y: lab.y1 / s, str: text, conf });
  }
  return content;
}
