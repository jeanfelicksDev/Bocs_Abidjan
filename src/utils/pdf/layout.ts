import type { ContainerType } from '../../types';

/**
 * Fragment de texte positionné sur une page, en points PDF (595 × 842 pour un A4),
 * origine en haut à gauche, `y` = ligne de base. Même forme pour le texte natif
 * (PDF.js) et pour l'OCR (Tesseract), afin qu'un seul jeu de règles lise les deux.
 */
export interface TextItem {
  page: number;
  x: number;
  y: number;
  str: string;
  /** Confiance OCR 0–100 ; absente pour le texte numérique natif. */
  conf?: number;
}

export interface PdfPage {
  page: number;
  width: number;
  height: number;
  items: TextItem[];
}

export interface PositionedDocument {
  pages: PdfPage[];
  wasOcr: boolean;
}

export interface Row {
  page: number;
  y: number;
  items: TextItem[];
}

/** Regroupe les fragments en lignes visuelles (tri haut → bas, gauche → droite). */
export function groupRows(items: TextItem[], tolerance = 2.5): Row[] {
  const rows: Row[] = [];
  const sorted = [...items].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  for (const it of sorted) {
    if (!it.str.trim()) continue;
    const row = rows.find((r) => r.page === it.page && Math.abs(r.y - it.y) <= tolerance);
    if (row) row.items.push(it);
    else rows.push({ page: it.page, y: it.y, items: [it] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows.sort((a, b) => a.page - b.page || a.y - b.y);
}

export const rowText = (items: TextItem[]) =>
  items.map((i) => i.str.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

export const inRange = (it: TextItem, x0: number, x1: number) => it.x >= x0 && it.x < x1;

/** Texte d'une ligne limité à une bande de colonnes [x0, x1). */
export const rowSlice = (row: Row, x0: number, x1: number) =>
  rowText(row.items.filter((i) => inRange(i, x0, x1)));

/** Confiance minimale des fragments OCR d'une liste (undefined si texte natif). */
export function minConf(items: TextItem[]): number | undefined {
  const c = items.map((i) => i.conf).filter((v): v is number => typeof v === 'number');
  return c.length ? Math.min(...c) : undefined;
}

/**
 * Nombres des documents maritimes : le dernier séparateur suivi de 1 à 3 chiffres
 * en fin de nombre est le séparateur décimal quand l'autre séparateur est aussi présent.
 *   "142.500,000" → 142500   "2.908,380" → 2908.38   "727,650" → 727.65
 *   "2908.38"     → 2908.38  "1.300.006" → 1300006
 * Aucune conversion d'unité implicite : le poids reste tel qu'écrit.
 */
export function parseMaritimeNumber(raw: string): number {
  if (!raw) return 0;
  const s = raw.replace(/[^\d.,]/g, '');
  if (!s || !/\d/.test(s)) return 0;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastComma > lastDot ? ',' : '.';
    const thousands = dec === ',' ? /\./g : /,/g;
    normalized = s.replace(thousands, '').replace(dec, '.');
  } else if (lastComma >= 0) {
    // Virgule seule : décimale (usage continental des manifestes), sauf groupes multiples
    normalized = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    normalized = s.replace(/\./g, '');
  } else {
    normalized = s;
  }
  const v = parseFloat(normalized);
  return Number.isFinite(v) ? v : 0;
}

/** Premier nombre « maritime » trouvé dans un texte (ex. "2.100,000 (T)" → 2100). */
export function firstNumber(text: string): number | undefined {
  const m = text.match(/\d[\d.,]*/);
  if (!m) return undefined;
  const v = parseMaritimeNumber(m[0]);
  return v > 0 ? v : undefined;
}

// ── Référentiels ────────────────────────────────────────────────────────────

const PORTS: Array<[RegExp, string]> = [
  [/ANTWERP|ANVERS|BEANR/, 'BEANR'],
  [/ROUEN|FRURO/, 'FRURO'],
  [/\bCAEN\b|FRCFR/, 'FRCFR'],
  [/LE\s*HAVRE|FRLEH/, 'FRLEH'],
  [/DUNKERQUE|DUNKIRK|FRDKK/, 'FRDKK'],
  [/MONTOIR|SAINT[\s-]*NAZAIRE|FRMTX/, 'FRMTX'],
  [/HAMBURG|HAMBOURG|DEHAM/, 'DEHAM'],
  [/BREMERHAVEN|DEBRV/, 'DEBRV'],
  [/\bBREMEN\b|BREME\b|DEBRE/, 'DEBRE'],
  [/ROTTERDAM|NLRTM/, 'NLRTM'],
  [/ABIDJAN|CIABJ/, 'CIABJ'],
  [/SAN[\s-]*PEDRO|CISPY/, 'CISPY'],
];

/** Code UN/LOCODE d'un port à partir de son libellé ; '' si inconnu. */
export function portCode(label: string): string {
  const u = label.toUpperCase();
  return PORTS.find(([re]) => re.test(u))?.[1] ?? '';
}

const COUNTRIES: Array<[RegExp, string]> = [
  [/BURKINA/, 'BF'],
  [/\bMALI\b/, 'ML'],
  [/\bNIGER\b/, 'NE'],
  [/C[OÔ]TE\s*D.?IVOIRE|IVORY\s*COAST/, 'CI'],
  [/GUIN[EÉ]E/, 'GN'],
  [/\bGHANA\b/, 'GH'],
  [/\bTOGO\b/, 'TG'],
];

/** Code pays ISO d'un libellé de destination ; '' si inconnu. */
export function countryCode(label: string): string {
  const u = label.toUpperCase();
  return COUNTRIES.find(([re]) => re.test(u))?.[1] ?? '';
}

// ── Conteneurs ──────────────────────────────────────────────────────────────

/** Numéro de conteneur ISO 6346 (4 lettres + 7 chiffres) dans un texte libre. */
export const CONTAINER_RE = /\b([A-Z]{3}[UJZ])\s?(\d{3})\s?(\d{3})\s?-?\s?(\d)\b/;

export function normalizeContainerNumber(raw: string): string | undefined {
  const m = raw.toUpperCase().match(CONTAINER_RE);
  return m ? `${m[1]}${m[2]}${m[3]}${m[4]}` : undefined;
}

/** Contrôle de la clé ISO 6346 (11ᵉ caractère). */
export function isValidContainerNumber(num: string): boolean {
  if (!/^[A-Z]{4}\d{7}$/.test(num)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = num[i];
    let v: number;
    if (i < 4) {
      v = ch.charCodeAt(0) - 55; // A=10
      v += Math.floor((v - 1) / 10); // saute 11, 22, 33
    } else {
      v = Number(ch);
    }
    sum += v * 2 ** i;
  }
  return (sum % 11) % 10 === Number(num[10]);
}

/** Type de conteneur depuis "20DV", "20' DV", "40HC", "40 RF", "20OT"… */
export function containerType(raw: string): ContainerType | undefined {
  const u = raw.toUpperCase().replace(/[\s']/g, '');
  const size = u.match(/(20|40|45)/)?.[1];
  if (!size) return undefined;
  const big = size !== '20';
  if (/RF|RE|REEFER|RH/.test(u)) return big ? '40_REEFER' : '20_REEFER';
  if (/OT|OPEN/.test(u)) return big ? '40_OPEN_TOP' : '20_OPEN_TOP';
  if (/FR|FLAT/.test(u)) return '20_FLAT_RACK';
  if (/HC|HQ|45/.test(u) || size === '45') return '40_HC';
  return big ? '40_DRY' : '20_DRY';
}

/** Numéros de plomb d'un texte "S:3606", "Seal Shipper: 3606 / 3607", "SEALS: A1, B2". */
export function parseSeals(text: string): string[] {
  return text
    .split(/[\/,;]|\s{2,}|\s+-\s+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9-]{3,20}$/.test(s) && /\d/.test(s));
}

/** Une ligne d'adresse ne doit jamais devenir une raison sociale. */
export const ADDRESS_LINE =
  /^(\d|B\.?\s?P\.?\s|RUE\b|AVENUE\b|AV\.|BOULEVARD\b|BD\b|QUAI\b|PLACE\b|ZONE\b|ROUTE\b|IMMEUBLE\b|LOT\b|TEL\b|CEDEX\b)/i;

// ── Catégorie de fret ───────────────────────────────────────────────────────

export function detectFretCategory(description: string, hasContainers: boolean) {
  if (hasContainers) return 'CONTENEUR' as const;
  const u = description.toUpperCase();
  if (/\bVRAC\b|\bBULK\b|\bEN\s+VRAC\b|IN\s+BULK/.test(u)) return 'VRAC' as const;
  if (/WAGON|V[EÉ]HICULE|VEHICLE|\bCAMION|\bTRUCK|TRACTEUR|TRACTOR|CHASSIS|RO-?RO|\bBUS\b|REMORQUE|TRAILER|ENGIN/.test(u))
    return 'RORO' as const;
  return 'CONVENTIONNEL' as const;
}

/** Références douanières : BESC/BSC/ECTN (le premier trouvé). */
export function findBesc(text: string): string | undefined {
  const m = text.match(/\b(?:BESC|BSC|ECTN)\s*(?:NO|NR|N°)?\.?\s*:?\s*([A-Z]{2,5}\s*-?\s*[A-Z0-9]{4,}|[A-Z0-9]{6,})/i);
  // La casse est conservée : les identifiants ECTN/BESC contiennent de l'hexadécimal minuscule.
  return m ? m[1].replace(/\s+/g, '') : undefined;
}

export function findDangerous(text: string) {
  const imo = text.match(/\bIMO\s*(?:CLASS|CL\.?)?\s*:?\s*(\d(?:\.\d)?)\b/i)?.[1];
  const un = text.match(/\bUN\s?(\d{4})\b/i)?.[1];
  return { isDangerous: Boolean(imo || un), imoClass: imo, unCode: un };
}
