import type { Invoice, InvoiceTypeConfig } from '../types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Rapprochement facture ↔ type de facture
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ce module est la SOURCE UNIQUE de vérité pour :
 *   • dériver le préfixe court d'un type de facture (`DET`, `SUR`, `CAU`…) ;
 *   • déduire le discriminant d'un type (`IMP`, `EXP`, `SOC`, `COC`) ;
 *   • décider si une facture donnée appartient (ou non) à un type de facture.
 *
 * Il remplace les rapprochements approximatifs dupliqués dans BlBillingModule,
 * FacturationModule et ImportModule, qui se contentaient d'un
 * `numeroFacture.includes(prefix)` ou d'un `typeFacture.includes(typeConfig.name)`.
 *
 * Défaut corrigé : « Détention Import » et « Détention Export » partagent le même
 * préfixe `DET`. Avec un simple `includes('DET')`, la carte « Détention Export »
 * captait la proforma « Détention Import » du même BL et affichait donc DEUX cartes
 * (dont une fantôme) portant le MÊME numéro de facture — le doublon constaté.
 * Désormais `invoiceTypeId` est la référence officielle : le repli par numérotation
 * est refusé dès qu'un préfixe est ambigu.
 */

/** Normalise un libellé : minuscules, sans accents, séparateurs unifiés. */
export const normalizeInvoiceLabel = (value?: string | null): string =>
  String(value ?? '')
    .normalize('NFD')
    // Retrait des diacritiques (é → e, è → e, …)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Dérive un préfixe court (3 lettres) depuis le nom du type de facture. */
export const getInvoiceTypePrefix = (typeName: string): string => {
  const n = normalizeInvoiceLabel(typeName);
  if (n.includes('telex')) return 'TEL';
  if (n.includes('surestarie')) return 'SUR';
  if (n.includes('detention')) return 'DET';
  if (n.includes('echange')) return 'ECH';
  if (n.includes('caution')) return 'CAU';
  if (n.includes('transfert')) return 'TRF';
  if (n.includes('fret')) return 'FRT';
  const clean = n.replace(/^facture\s+/, '').trim();
  return clean.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'FAC';
};

/**
 * Code discriminant d'un type de facture.
 * Indispensable pour départager les types qui partagent un préfixe
 * (« Détention Import » vs « Détention Export » → même préfixe `DET`).
 */
export const getInvoiceTypeDiscriminant = (typeName?: string | null): string => {
  const n = normalizeInvoiceLabel(typeName);
  if (!n) return '';
  if (/(^|\s)export(\s|$)/.test(n)) return 'EXP';
  if (/(^|\s)import(\s|$)/.test(n)) return 'IMP';
  if (/(^|\s)soc(\s|$)/.test(n)) return 'SOC';
  if (/(^|\s)coc(\s|$)/.test(n)) return 'COC';
  return '';
};

/** Type (caractères 3 à 5) d'une référence au format sans séparateur. */
const NEW_FORMAT_TYPE = /^(?:PF|FA|AV)([A-Z]{3})[A-Z0-9]{4}[A-Z0-9]+[A-Z0-9]{6}(?:-[0-9]+)?$/;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Le préfixe apparaît-il — à sa place légitime — dans la référence de facture ?
 *
 * Les trois familles de numérotation BOCS sont reconnues :
 *   0. `STATUT TYPE NAVIRE VOYAGE BL` sans séparateur (ex. `FAECHMANA26607123456`,
 *      voir `utils/invoiceNumber`) : le type occupe les caractères 3 à 5. Les
 *      détentions y sont codées `DTI` / `DTE` : elles répondent aussi à `DET`.
 *   1. `[FA-]PREFIX<chiffres du voyage>[-BOCS###]` (ex. `FA-SUR23409-BOCS001`) :
 *      le préfixe ouvre la référence et est IMMÉDIATEMENT suivi des chiffres du
 *      voyage — c'est exactement ce que produit `getNextInvoiceNumber`.
 *   2. `PROF-<régime>[-<discriminant>]-<BL>-<AAAAMM>` (ex. `PROF-DET-IMP-…-202609`) :
 *      le préfixe est alors un JETON DÉLIMITÉ par des séparateurs non alphanumériques.
 *
 * Un simple `includes` produirait des faux positifs (ex. `DET` au milieu d'une
 * séquence alphanumérique) : les deux motifs ci-dessus exigent soit la position
 * d'ouverture suivie de chiffres, soit une délimitation franche.
 */
export const invoiceNumberHasToken = (numeroFacture?: string | null, token?: string): boolean => {
  const num = String(numeroFacture ?? '').toUpperCase();
  const t = String(token ?? '').toUpperCase();
  if (!num || !t) return false;
  const nouveau = NEW_FORMAT_TYPE.exec(num);
  if (nouveau) {
    const type = nouveau[1];
    return type === t || (t === 'DET' && (type === 'DTI' || type === 'DTE'));
  }
  const esc = escapeRegex(t);
  // Famille 1 : préfixe en tête de référence, suivi des chiffres du voyage.
  if (new RegExp(`^(?:FA-)?${esc}(?=\\d)`).test(num)) return true;
  // Famille 2 : préfixe délimité (numérotation composée PROF-…).
  return new RegExp(`(?:^|[^A-Z0-9])${esc}(?=$|[^A-Z0-9])`).test(num);
};

/** Discriminant éventuellement porté par la référence de facture (`''` si absent). */
export const getDiscriminantFromNumber = (numeroFacture?: string | null): string => {
  const num = String(numeroFacture ?? '').toUpperCase();
  if (!num) return '';
  const nouveau = NEW_FORMAT_TYPE.exec(num);
  if (nouveau) return nouveau[1] === 'DTE' ? 'EXP' : nouveau[1] === 'DTI' ? 'IMP' : '';
  if (/(?:^|[^A-Z0-9])EXP(?=$|[^A-Z0-9])/.test(num)) return 'EXP';
  if (/(?:^|[^A-Z0-9])IMP(?=$|[^A-Z0-9])/.test(num)) return 'IMP';
  return '';
};

/** Une facture est-elle active (ni annulée, ni remplacée par un avoir) ? */
export const isActiveInvoice = (invoice?: Invoice | null): boolean =>
  !!invoice && invoice.statutFacture !== 'ANNULEE' && invoice.statutFacture !== 'AVOIR';

/**
 * Rapprochement STRICT d'une facture avec un type de facture.
 *
 * Priorité :
 *   1. `invoiceTypeId` — référence officielle, seule source de vérité.
 *   2. Libellé strictement identique (`typeFacture` ⇄ `typeConfig.name`),
 *      casse et accents neutralisés.
 *   3. Repli « numérotation », réservé aux factures historiques SANS type
 *      rattaché, et uniquement si :
 *        • le préfixe est porté comme jeton entier par la référence, ET
 *        • ce préfixe n'est partagé par AUCUN autre type configuré, ET
 *        • le discriminant (IMP/EXP) n'est pas contradictoire quand il existe.
 */
export const invoiceMatchesType = (
  invoice: Invoice | null | undefined,
  typeConfig: InvoiceTypeConfig | null | undefined,
  allTypeConfigs: InvoiceTypeConfig[] = []
): boolean => {
  if (!invoice || !typeConfig) return false;

  // 1. Référence officielle du type — verdict immédiat.
  if (invoice.invoiceTypeId && String(invoice.invoiceTypeId) === String(typeConfig.id)) {
    return true;
  }

  // 2. Libellé strict (factures dont le type est figé dans `typeFacture`).
  const invLabel = normalizeInvoiceLabel(String(invoice.typeFacture ?? ''));
  const cfgLabel = normalizeInvoiceLabel(typeConfig.name);
  if (invLabel && cfgLabel && invLabel === cfgLabel) return true;

  // 3. Repli numérotation : jamais pour une facture déjà typée — sinon les types
  //    partageant un préfixe se remettraient à se voler leurs factures.
  if (invoice.invoiceTypeId) return false;

  const prefix = getInvoiceTypePrefix(typeConfig.name);
  if (!prefix || !invoiceNumberHasToken(invoice.numeroFacture, prefix)) return false;

  // Préfixe ambigu (ex. `DET` pour « Détention Import » ET « Détention Export »)
  // → le repli est refusé, faute de pouvoir conclure.
  const prefixIsShared =
    allTypeConfigs.filter(t => getInvoiceTypePrefix(t.name) === prefix).length > 1;
  if (prefixIsShared) return false;

  // Discriminant contradictoire → refus.
  const cfgDisc = getInvoiceTypeDiscriminant(typeConfig.name);
  const invDisc =
    getDiscriminantFromNumber(invoice.numeroFacture) ||
    getInvoiceTypeDiscriminant(String(invoice.typeFacture ?? ''));
  if (cfgDisc && invDisc && cfgDisc !== invDisc) return false;

  return true;
};

/**
 * Rapprochement appliqué à une collection.
 * `extraFilter` permet d'exiger un statut (ex. exclure les avoirs).
 */
export const findInvoiceForType = (
  invoices: Invoice[],
  typeConfig: InvoiceTypeConfig | null | undefined,
  allTypeConfigs: InvoiceTypeConfig[] = [],
  extraFilter?: (invoice: Invoice) => boolean
): Invoice | undefined =>
  invoices.find(
    inv => (!extraFilter || extraFilter(inv)) && invoiceMatchesType(inv, typeConfig, allTypeConfigs)
  );

/** Factures rattachées à un BL (par identifiant ou par référence de connaissement). */
export const invoicesOfBl = (invoices: Invoice[], blId?: number, numeroBL?: string): Invoice[] =>
  invoices.filter(
    inv => (blId !== undefined && inv.blId === blId) || (!!numeroBL && inv.numeroBL === numeroBL)
  );

// Numérotation, unicité et registre des numéros émis : voir `utils/invoiceNumber`.
