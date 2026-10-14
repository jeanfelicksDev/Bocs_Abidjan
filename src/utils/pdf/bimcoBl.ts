/**
 * Lecture du connaissement BIMCO « CONLINEBILL 2000 » utilisé par BOCS.
 *
 * Les libellés du formulaire (Shipper, Consignee, B/L No., Vessel…) font partie du
 * fond de page : dans le PDF numérique seules les valeurs sont du texte. On lit donc
 * chaque case par sa position. Les zones sont exprimées en points sur un A4
 * (595 × 842, origine en haut à gauche) et mises à l'échelle de la page réelle.
 * Une page = un connaissement (un scan peut en contenir plusieurs).
 */
import {
  ADDRESS_LINE,
  CONTAINER_RE,
  containerType,
  firstNumber,
  groupRows,
  inRange,
  minConf,
  parseSeals,
  portCode,
  rowText,
  type PdfPage,
  type Row,
  type TextItem,
} from './layout.ts';
import { finalizeBl, goodsLines, newContainer, splitParty } from './common.ts';
import { emptyParsedBl, type ParsedBl } from './types.ts';

type Zone = [x0: number, y0: number, x1: number, y1: number];

export const BIMCO_ZONES = {
  shipper: [30, 22, 322, 79],
  consignee: [30, 79, 322, 135],
  notify: [30, 135, 322, 194],
  blNo: [322, 80, 462, 110],
  reference: [462, 80, 585, 110],
  vessel: [322, 110, 585, 140],
  pol: [322, 140, 585, 167],
  pod: [322, 167, 585, 194],
  marks: [30, 226, 176, 460],
  qty: [176, 226, 211, 460],
  desc: [211, 226, 373, 460],
  gross: [373, 226, 477, 460],
  meas: [477, 226, 585, 460],
  shippedOnBoard: [322, 618, 455, 652],
} satisfies Record<string, Zone>;

export type BimcoZoneName = keyof typeof BIMCO_ZONES;

/** Zone mise à l'échelle d'une page de dimensions quelconques. */
export function scaledZone(name: BimcoZoneName, width: number, height: number): Zone {
  const [x0, y0, x1, y1] = BIMCO_ZONES[name];
  const sx = width / 595;
  const sy = height / 842;
  return [x0 * sx, y0 * sy, x1 * sx, y1 * sy];
}

/** Libellés imprimés du formulaire (présents seulement dans un scan lu par OCR). */
const FORM_LABEL =
  /(full\s+style|address\)|or\s+order|B\/L\s*No|Reference\s+No|^\W*Vessel\W*$|Port\s+of\s+(loading|discharge)|Container\s+No|Seal\s+No|Marks\s+and|Number\s+and\s+kind|description\s+of\s+cargo|Gross\s+weight|Measurement|PARTICULARS\s+DECLARED|Date\s+shipped|COPY\s+NOT\s+NEGOTIABLE)/i;

/** Clauses de style imprimées dans la case marques, sans valeur pour l'intégration. */
const CLAUSE =
  /(SAID\s+TO\s+CONTAIN|SHIPPER'?S\s+LOAD|STOWAGE,?\s+WEIGH|SHIPPED\s+ON\s+DECK|NOT\s+LIABLE|HOWSOEVER|^FCL\/FCL|COPY\s+NOT\s+NEGOTIABLE)/i;

function zoneRows(page: PdfPage, name: BimcoZoneName, tolerance: number): Row[] {
  const [x0, y0, x1, y1] = scaledZone(name, page.width, page.height);
  const items = page.items.filter((i: TextItem) => inRange(i, x0, x1) && i.y >= y0 && i.y < y1);
  return groupRows(items, tolerance);
}

function zoneLines(page: PdfPage, name: BimcoZoneName, tolerance: number): string[] {
  return zoneRows(page, name, tolerance)
    .map((r) => rowText(r.items))
    .filter((l) => l && !FORM_LABEL.test(l));
}

const BL_NUMBER = /\b[A-Z]{3,6}[A-Z0-9]*\d{5,}\b/;

export function isBimcoBl(pages: PdfPage[]): boolean {
  const text = pages.flatMap((p) => p.items.map((i) => i.str)).join(' ').toUpperCase();
  if (/CONLINEBILL|BIMCO\s+LINER\s+BILL/.test(text)) return true;
  // PDF numérique sans libellés : un numéro de BL dans la case « B/L No. » suffit.
  const first = pages[0];
  return Boolean(first && BL_NUMBER.test(zoneLines(first, 'blNo', 2.5).join(' ')));
}

export function parseBimcoBl(pages: PdfPage[], isOcr = false): ParsedBl[] {
  const tol = isOcr ? 4 : 2.5;
  const results: ParsedBl[] = [];

  for (const page of pages) {
    const lines = (z: BimcoZoneName) => zoneLines(page, z, tol);
    const numeroBL = lines('blNo').join(' ').match(BL_NUMBER)?.[0];
    if (!numeroBL) continue; // page de conditions générales ou page vide

    const bl = emptyParsedBl('BL_BIMCO');
    bl.numeroBL = numeroBL;
    bl.referenceNumero = lines('reference').join(' ').match(/[\d.]{4,}|[A-Z0-9-]{4,}/)?.[0];

    const [sh, co, nf] = resolveParties(page, tol, bl);
    Object.assign(bl, {
      shipperNom: sh.nom,
      shipperAdresse: sh.adresse,
      consigneeNom: co.nom,
      consigneeAdresse: co.adresse,
      notifyNom: nf.nom,
      notifyAdresse: nf.adresse,
    });

    const vessel = lines('vessel').join(' ').replace(/^\W*Vessel\b\W*/i, '');
    const [navire, voyage] = vessel.split(/\bVOY(?:AGE)?\.?\s*:?\s*/i);
    bl.nomNavire = (navire || '').trim().toUpperCase();
    bl.numeroVoyage = (voyage || '').trim().split(/\s+/)[0]?.toUpperCase() || '';

    const pol = lines('pol').join(' ');
    const pod = lines('pod').join(' ');
    bl.portChargementCode = portCode(pol);
    bl.portDechargementCode = portCode(pod);
    if (pol && !bl.portChargementCode) bl.aVerifier.push({ field: 'portChargementCode', message: `Port de chargement inconnu : « ${pol} »` });
    if (pod && !bl.portDechargementCode) bl.aVerifier.push({ field: 'portDechargementCode', message: `Port de déchargement inconnu : « ${pod} »` });

    const shipped = lines('shippedOnBoard').join(' ').match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
    if (shipped) bl.dateEmbarquement = shipped;

    // ── Marchandise ──
    const descLines = lines('desc');
    const descAll = descLines.join('\n');
    const goods = goodsLines(descLines);
    bl.descriptionGoods = goods.join('\n');

    const qty = lines('qty').map((l) => l.match(/^\d+$/)?.[0]).find(Boolean);

    // Marques, conteneurs et plombs (case de gauche), sans les réserves « CARGO REMARKS ».
    const marks: string[] = [];
    let inRemarks = false;
    let current: ReturnType<typeof newContainer> | undefined;
    for (const line of lines('marks')) {
      if (CLAUSE.test(line)) continue;
      if (/^CARGO\s+REMARKS/i.test(line)) {
        inRemarks = true;
        continue;
      }
      const ctr = line.toUpperCase().match(CONTAINER_RE);
      if (ctr) {
        current = newContainer(`${ctr[1]}${ctr[2]}${ctr[3]}${ctr[4]}`);
        bl.conteneurs.push(current);
      }
      const seal = line.match(/\bSEALS?\b[^:]*:\s*(.+)$/i) || line.match(/\bS:\s*(.+)$/);
      if (seal && current) {
        const all = [...(current.numeroScelle ? current.numeroScelle.split(' / ') : []), ...parseSeals(seal[1])];
        current.numeroScelle = all.join(' / ');
        continue;
      }
      if (ctr || inRemarks) continue;
      marks.push(line.replace(/^MARKS\s*:\s*/i, ''));
    }
    bl.marquesEtNumeros = marks.filter(Boolean).join(' ');

    // Poids : nombre seul = poids brut ; « TARE: » / « NET: » quand la ligne les détaille.
    const grossLines = lines('gross');
    const tare = firstNumber(grossLines.find((l) => /TARE/i.test(l)) || '');
    const net = firstNumber(grossLines.find((l) => /\bNET\b/i.test(l)) || '');
    const plain = grossLines.filter((l) => /^[\d.,\s]+$/.test(l)).map((l) => firstNumber(l)).filter((v): v is number => v !== undefined);
    const declared = firstNumber(descAll.match(/POIDS\s+BRUT\s+TOTAL\s*:\s*([\d.,]+)/i)?.[1] || '');

    bl.poidsBrutKg = declared ?? plain.reduce((a, v) => a + v, 0) ?? 0;
    if (!bl.poidsBrutKg && net) {
      bl.poidsBrutKg = net;
      bl.aVerifier.push({ field: 'poidsBrutKg', message: 'Poids brut repris de la case « NET » du BL' });
    }
    bl.volumeM3 = lines('meas').map((l) => firstNumber(l)).find((v) => v !== undefined) ?? 0;

    bl.conteneurs.forEach((c, i) => {
      if (bl.conteneurs.length === 1) c.poidsKg = bl.poidsBrutKg;
      else if (plain.length === bl.conteneurs.length) c.poidsKg = plain[i];
      if (tare && bl.conteneurs.length === 1) c.tareKg = tare;
      const t = descAll.match(/\b(20|40|45)\s*'?\s*(DV|DC|GP|HC|HQ|RF|RH|OT|FR)\b/i);
      if (t) c.typeConteneur = containerType(t[0]) || c.typeConteneur;
      if (/\bSOC\b/.test(descAll)) c.socCoc = 'SOC';
      else if (/\bCOC\b/.test(descAll)) c.socCoc = 'COC';
    });
    if (bl.conteneurs.length === 1) {
      const pal = descAll.match(/total\s*:\s*(\d+)\s*(palettes?|pal|colis|cartons?|packages?|pcs|pieces?)/i);
      if (pal) bl.conteneurs[0].nombreColis = Number(pal[1]);
    }

    bl.nombreColis = qty ? Number(qty) : 0;
    if (!bl.conteneurs.length) bl.typeEmballage = (goods[0] || '').split(/\s+/)[0]?.toUpperCase() || '';

    finalizeBl(bl, descAll, isOcr);
    flagLowConfidence(bl, page, isOcr);
    results.push(bl);
  }
  return results;
}

type Party = { lines: string[]; conf?: number };

/** Confiance OCR minimale pour qu'un nom en remplace un autre. */
const MIN_NAME_CONF = 60;

/** Raison sociale plausible : majuscules, au moins un mot de 3 lettres, peu de ponctuation. */
const plausibleName = (s: string) =>
  /^[A-Z0-9&.,'()\/ -]+$/.test(s) && /[A-Z]{3}/.test(s) && (s.match(/[^A-Z0-9 ]/g) || []).length <= s.length / 4;

/**
 * Shipper / Consignee / Notify, avec deux garde-fous pour les scans :
 *  - si la 1ʳᵉ ligne lue est une adresse, le nom est illisible → nom vide + signalement ;
 *  - Consignee et Notify à adresse identique : le nom manquant ou le moins sûr est
 *    repris de l'autre case (cas courant « notify = consignee »), avec signalement.
 */
function resolveParties(page: PdfPage, tol: number, bl: ParsedBl) {
  const read = (z: BimcoZoneName): Party => {
    const rows = zoneRows(page, z, tol).filter((r) => {
      const t = rowText(r.items);
      return t && !FORM_LABEL.test(t);
    });
    return { lines: rows.map((r) => rowText(r.items)), conf: minConf(rows[0]?.items || []) };
  };
  const [sh, co, nf] = (['shipper', 'consignee', 'notify'] as const).map(read);
  const labels = { shipper: 'Expéditeur', consignee: 'Destinataire', notify: 'Partie à notifier' };
  const fields = { shipper: 'shipperNom', consignee: 'consigneeNom', notify: 'notifyNom' };

  const named = (p: Party, z: keyof typeof labels) => {
    if (p.lines.length && ADDRESS_LINE.test(p.lines[0])) {
      bl.aVerifier.push({ field: fields[z], message: `${labels[z]} : nom illisible sur le document` });
      return { nom: '', adresse: splitParty(['', ...p.lines]).adresse, conf: 0, addr: p.lines };
    }
    return { ...splitParty(p.lines), conf: p.conf ?? 100, addr: p.lines.slice(1) };
  };
  const s = named(sh, 'shipper');
  const c = named(co, 'consignee');
  const n = named(nf, 'notify');

  const sameAddress = c.addr.length > 0 && c.addr.join('|') === n.addr.join('|');
  if (sameAddress && c.nom !== n.nom) {
    const [from, to, toKey] = c.conf >= n.conf ? [c, n, 'notify' as const] : [n, c, 'consignee' as const];
    if (plausibleName(from.nom) && from.conf >= MIN_NAME_CONF) {
      bl.aVerifier.push({
        field: fields[toKey],
        message: `${labels[toKey]} « ${to.nom || '—'} » remplacé par « ${from.nom} » (même adresse, lecture plus sûre)`,
      });
      to.nom = from.nom;
    }
  }
  return [s, c, n];
}

/** Signale les cases dont l'OCR est peu sûre (confiance < 75 %). */
function flagLowConfidence(bl: ParsedBl, page: PdfPage, isOcr: boolean) {
  if (!isOcr) return;
  const checks: Array<[BimcoZoneName, string, string]> = [
    ['shipper', 'shipperNom', 'Expéditeur'],
    ['consignee', 'consigneeNom', 'Destinataire'],
    ['notify', 'notifyNom', 'Partie à notifier'],
    ['blNo', 'numeroBL', 'N° de BL'],
    ['gross', 'poidsBrutKg', 'Poids brut'],
  ];
  for (const [zone, field, label] of checks) {
    // Seuls les mots repris dans la valeur retenue comptent (pas les libellés ni le bruit).
    const value = String(bl[field as keyof ParsedBl] ?? '');
    const kept = (s: string) => (field === 'poidsBrutKg' ? /^\d[\d.,]*$/.test(s) : s.length > 1 && value.includes(s));
    const items = zoneRows(page, zone, 4).flatMap((r) => r.items).filter((i) => kept(i.str.trim()));
    const low = items.filter((i) => typeof i.conf === 'number' && i.conf < 75);
    if (low.length && !bl.aVerifier.some((f) => f.field === field)) {
      bl.aVerifier.push({ field, message: `${label} : lecture OCR incertaine (${low.map((i) => i.str).join(' ')})` });
    }
  }
}
