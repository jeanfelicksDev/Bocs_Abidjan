import type { BL, Escale, Invoice, InvoiceTypeConfig, Vessel } from '../types';
import { getInvoiceTypeDiscriminant, getInvoiceTypePrefix, normalizeInvoiceLabel } from './invoiceMatching.ts';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Numérotation des factures BOCS — source unique
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   STATUT  TYPE  NAVIRE  VOYAGE    BL        [-RANG]
 *   FA      ECH   MANA    26607     123456
 *   → stocké  `FAECHMANA26607123456`
 *   → affiché `FA ECH MANA 26607 123456`
 *
 *   • STATUT (2)  PF proforma · FA facture définitive · AV avoir
 *   • TYPE   (3)  CAU ECH TEL TRF SUR DTI DTE FRT AMD…
 *   • NAVIRE (4)  code court du registre des navires
 *   • VOYAGE      numéro de voyage de l'escale, longueur libre
 *   • BL     (6)  6 derniers caractères du connaissement
 *   • -RANG       uniquement si la référence existe déjà (réémission, complément)
 *
 * Sans séparateur, ce sont les longueurs fixes qui rendent le numéro décodable :
 * 9 caractères en tête, 6 en queue, le voyage au milieu.
 *
 * Les anciennes références (`FA-CAU26607-BOCS001`, `PROF-DET-…`, `AV-BOCS260001`)
 * restent valides et lisibles : une facture émise ne change jamais de numéro.
 */

export type InvoiceStatutCode = 'PF' | 'FA' | 'AV';

export interface DecodedInvoiceNumber {
  statut: InvoiceStatutCode;
  type: string;
  navire: string;
  voyage: string;
  bl: string;
  /** Rang de réémission (`2` pour `-2`) ; absent pour la première émission. */
  rang?: number;
}

const NEW_FORMAT = /^(PF|FA|AV)([A-Z]{3})([A-Z0-9]{4})([A-Z0-9]+)([A-Z0-9]{6})(?:-(\d+))?$/;

const alnum = (value?: string | null): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

/** Lit une référence au nouveau format ; `null` pour une référence historique. */
export const decodeInvoiceNumber = (numero?: string | null): DecodedInvoiceNumber | null => {
  const m = NEW_FORMAT.exec(String(numero ?? '').trim().toUpperCase());
  if (!m) return null;
  return {
    statut: m[1] as InvoiceStatutCode,
    type: m[2],
    navire: m[3],
    voyage: m[4],
    bl: m[5],
    ...(m[6] ? { rang: parseInt(m[6], 10) } : {})
  };
};

/** Affichage groupé (`FA ECH MANA 26607 123456`) ; une référence historique est rendue telle quelle. */
export const formatInvoiceNumber = (numero?: string | null): string => {
  const raw = String(numero ?? '');
  const d = decodeInvoiceNumber(raw);
  if (!d) return raw;
  return `${d.statut} ${d.type} ${d.navire} ${d.voyage} ${d.bl}${d.rang ? `-${d.rang}` : ''}`;
};

/** Forme compacte d'une saisie (recherche) : `fa ech mana` → `FAECHMANA`. */
export const compactInvoiceQuery = (query: string): string => query.replace(/\s+/g, '').toUpperCase();

/** La référence correspond-elle à la recherche, saisie compacte ou groupée (`FA ECH MANA`) ? */
export const invoiceNumberMatchesQuery = (numero: string | null | undefined, query: string): boolean => {
  const num = String(numero ?? '').toUpperCase();
  const q = query.trim().toUpperCase();
  return !!q && (num.includes(q) || num.includes(compactInvoiceQuery(q)));
};

/**
 * La référence désigne-t-elle ce type (`DET`, `SUR`…) ? Au nouveau format, seul le
 * segment type compte (un code navire `SURF` ne fait pas une surestarie) ; les
 * détentions `DTI` / `DTE` répondent à `DET`. Ancienne référence : recherche du texte.
 */
export const invoiceNumberMentionsType = (numero: string | null | undefined, typeCode: string): boolean => {
  const d = decodeInvoiceNumber(numero);
  if (!d) return String(numero ?? '').toUpperCase().includes(typeCode);
  return d.type === typeCode || (typeCode === 'DET' && (d.type === 'DTI' || d.type === 'DTE'));
};

/** Référence définitive : nouveau format `FA…` ou ancien `FA-…`. */
export const isDefinitiveInvoiceNumber = (numero?: string | null): boolean => {
  const num = String(numero ?? '').trim().toUpperCase();
  return num.startsWith('FA-') || decodeInvoiceNumber(num)?.statut === 'FA';
};

/** Proforma = ni validée, ni porteuse d'une référence définitive. */
export const isProformaInvoice = (inv?: Pick<Invoice, 'numeroFacture' | 'statutFacture'> | null): boolean =>
  !!inv && inv.statutFacture !== 'VALIDEE' && !isDefinitiveInvoiceNumber(inv.numeroFacture);

// ── Segments ────────────────────────────────────────────────────────────────

/**
 * Code type sur 3 lettres. « Détention Import / Export » partagent le préfixe
 * historique `DET` : ils deviennent `DTI` / `DTE` pour rester distincts.
 */
export const getInvoiceTypeCode = (typeName?: string | null): string => {
  const n = normalizeInvoiceLabel(typeName);
  if (!n) return 'FAC';
  if (n.includes('amendement') || n.includes('correction')) return 'AMD';
  const prefix = getInvoiceTypePrefix(typeName || '');
  if (prefix === 'DET') {
    const disc = getInvoiceTypeDiscriminant(typeName);
    if (disc === 'IMP') return 'DTI';
    if (disc === 'EXP') return 'DTE';
  }
  return (prefix + 'XXX').slice(0, 3);
};

/**
 * Code navire proposé à partir du nom (4 caractères) :
 * première lettre du premier mot + 3 premières du dernier (`MSC ANA` → `MANA`,
 * `CMA CGM KRIBI` → `CKRI`), ou 4 premières lettres d'un nom en un mot (`BREMEN` → `BREM`).
 */
export const suggestVesselCode = (nom?: string | null): string => {
  const words = String(nom ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return 'XXXX';
  const code = words.length === 1 ? words[0] : words[0][0] + words[words.length - 1];
  return (code + 'XXXX').slice(0, 4);
};

/** Code navire saisi, ramené à 4 caractères alphanumériques majuscules (`''` si vide). */
export const normalizeVesselCode = (code?: string | null): string => alnum(code).slice(0, 4);

/**
 * Proposition de code libre dans le registre : la suggestion du nom, sinon la même
 * avec un chiffre final (`MANA` pris → `MAN2`, `MAN3`…).
 */
export const uniqueVesselCode = (nom: string, vessels: Vessel[] = [], exceptId?: number): string => {
  const taken = new Set(
    vessels.filter(v => v.id !== exceptId).map(v => normalizeVesselCode(v.codeNavire)).filter(Boolean)
  );
  const base = suggestVesselCode(nom);
  if (!taken.has(base)) return base;
  for (let i = 2; i <= 9; i++) {
    const candidate = base.slice(0, 3) + i;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
};

/**
 * Code navire d'une escale : celui du registre, sinon dérivé du nom du navire.
 * Le registre est cherché par identifiant, puis par nom.
 */
export const resolveVesselCode = (
  escale?: Pick<Escale, 'vesselId' | 'nomNavire'> | null,
  vessels: Vessel[] = [],
  nomNavire?: string | null
): string => {
  const nom = escale?.nomNavire || nomNavire || '';
  const vessel =
    (escale?.vesselId != null ? vessels.find(v => v.id === escale.vesselId) : undefined) ||
    vessels.find(v => v.nom && v.nom.trim().toUpperCase() === nom.trim().toUpperCase());
  const code = normalizeVesselCode(vessel?.codeNavire);
  return code.length === 4 ? code : suggestVesselCode(vessel?.nom || nom);
};

/** Voyage normalisé ; `SV` (sans voyage) si absent. */
const voyageSegment = (voyage?: string | null): string => {
  const v = alnum(voyage);
  return v && v !== 'VOYAGE' && v !== 'SANSVOYAGE' ? v : 'SV';
};

/** 6 derniers caractères du BL, complétés par des zéros à gauche si nécessaire. */
const blSegment = (numeroBL?: string | null): string => alnum(numeroBL).slice(-6).padStart(6, '0');

export interface InvoiceNumberParts {
  statut: InvoiceStatutCode;
  typeName?: string | null;
  /** Code type déjà connu (prioritaire sur `typeName`). */
  typeCode?: string;
  vesselCode: string;
  voyage?: string | null;
  numeroBL?: string | null;
}

/** Référence de base, sans rang : `FAECHMANA26607123456`. */
export const buildInvoiceNumberBase = (parts: InvoiceNumberParts): string =>
  [
    parts.statut,
    (alnum(parts.typeCode) || getInvoiceTypeCode(parts.typeName)).slice(0, 3).padEnd(3, 'X'),
    (normalizeVesselCode(parts.vesselCode) || 'XXXX').padEnd(4, 'X'),
    voyageSegment(parts.voyage),
    blSegment(parts.numeroBL)
  ].join('');

// ── Unicité ─────────────────────────────────────────────────────────────────

/**
 * Registre de session des numéros émis (persisté en `localStorage`).
 * Lors d'émissions successives dans un même cycle de rendu, l'état React est
 * encore périmé : sans ce registre, deux factures recevraient le même numéro.
 */
const ISSUED_NUMBERS_KEY = 'bocs_issued_invoice_numbers';

const issuedNumberRegistry: Set<string> = (() => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ISSUED_NUMBERS_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((n: unknown) => String(n)) : []);
  } catch {
    return new Set<string>();
  }
})();

/** Mémorise un numéro pour interdire sa réutilisation. */
export const rememberIssuedNumber = (numero: string): void => {
  if (!numero) return;
  issuedNumberRegistry.add(numero);
  try {
    localStorage.setItem(ISSUED_NUMBERS_KEY, JSON.stringify([...issuedNumberRegistry]));
  } catch {
    /* quota / mode privé : le registre mémoire suffit */
  }
};

/**
 * `PF…X` et `FA…X` sont la même facture avant et après validation : une référence
 * est prise dès que l'une de ces deux formes existe. Les avoirs (`AV`) ont leur propre espace.
 */
const lifecycleForms = (numero: string): string[] => {
  const statut = decodeInvoiceNumber(numero)?.statut;
  return statut === 'PF' || statut === 'FA' ? [`PF${numero.slice(2)}`, `FA${numero.slice(2)}`] : [numero];
};

/**
 * Numéro unique dérivé de `base` : `base` s'il est libre, sinon `base-2`, `base-3`…
 * Le numéro retenu est mémorisé. L'unicité est exigée par la certification DGI / FNE.
 */
export const resolveUniqueInvoiceNumber = (base: string, existingNumbers: Iterable<string>): string => {
  const taken = new Set(existingNumbers);
  const isTaken = (candidate: string) =>
    lifecycleForms(candidate).some(form => taken.has(form) || issuedNumberRegistry.has(form));
  let candidate = base;
  for (let rang = 2; isTaken(candidate); rang++) candidate = `${base}-${rang}`;
  rememberIssuedNumber(candidate);
  return candidate;
};

const invoiceNumbers = (invoices: Pick<Invoice, 'id' | 'numeroFacture'>[], exceptId?: number): string[] =>
  invoices.filter(inv => inv.id !== exceptId).map(inv => inv.numeroFacture).filter(Boolean);

/** Prochain numéro libre pour une facture neuve. */
export const nextInvoiceNumber = (
  parts: InvoiceNumberParts,
  invoices: Pick<Invoice, 'id' | 'numeroFacture'>[],
  currentInvoiceId?: number
): string => resolveUniqueInvoiceNumber(buildInvoiceNumberBase(parts), invoiceNumbers(invoices, currentInvoiceId));

// ── Dérivation depuis une facture existante ─────────────────────────────────

export interface InvoiceNumberContext {
  bls?: BL[];
  escales?: Escale[];
  vessels?: Vessel[];
  invoiceTypeConfigs?: InvoiceTypeConfig[];
}

/** Segments d'une facture existante, retrouvés depuis son BL, son escale et son type. */
const partsOfInvoice = (
  invoice: Invoice,
  statut: InvoiceStatutCode,
  ctx: InvoiceNumberContext
): InvoiceNumberParts => {
  const bl = ctx.bls?.find(b => b.id === invoice.blId || b.numeroBL === invoice.numeroBL);
  const escale = bl ? ctx.escales?.find(e => e.id === bl.escaleId) : undefined;
  // `escaleInfo` = « NAVIRE V.VOYAGE » quand l'escale n'est plus disponible.
  const [infoNavire, infoVoyage] = String(invoice.escaleInfo ?? '').split(/\s+V\./i);
  const typeName =
    ctx.invoiceTypeConfigs?.find(t => String(t.id) === String(invoice.invoiceTypeId))?.name ||
    String(invoice.typeFacture ?? '');
  return {
    statut,
    typeName,
    vesselCode: resolveVesselCode(escale, ctx.vessels, infoNavire),
    voyage: escale?.numeroVoyage || infoVoyage,
    numeroBL: invoice.numeroBL || bl?.numeroBL
  };
};

/**
 * Change le statut d'une référence en conservant tout le reste
 * (`PF…` → `FA…` à la validation, `FA…` → `AV…` pour l'avoir).
 * Une référence historique est reconstruite depuis les données de la facture.
 */
export const invoiceNumberWithStatut = (
  invoice: Invoice,
  statut: InvoiceStatutCode,
  invoices: Pick<Invoice, 'id' | 'numeroFacture'>[],
  ctx: InvoiceNumberContext
): string => {
  const decoded = decodeInvoiceNumber(invoice.numeroFacture);
  const base = decoded
    ? `${statut}${decoded.type}${decoded.navire}${decoded.voyage}${decoded.bl}`
    : buildInvoiceNumberBase(partsOfInvoice(invoice, statut, ctx));
  // La facture garde son rang : PF…-2 validée devient FA…-2, si ce numéro est libre.
  const preferred = decoded?.rang ? `${base}-${decoded.rang}` : base;
  const numbers = invoiceNumbers(invoices, invoice.id);
  if (!numbers.includes(preferred) && !issuedNumberRegistry.has(preferred)) {
    rememberIssuedNumber(preferred);
    return preferred;
  }
  return resolveUniqueInvoiceNumber(base, numbers);
};

/** Numéro d'une nouvelle proforma reprenant une facture existante (duplication). */
export const invoiceNumberForDuplicate = (
  invoice: Invoice,
  invoices: Pick<Invoice, 'id' | 'numeroFacture'>[],
  ctx: InvoiceNumberContext
): string => resolveUniqueInvoiceNumber(buildInvoiceNumberBase(partsOfInvoice(invoice, 'PF', ctx)), invoiceNumbers(invoices));
