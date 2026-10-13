import type { BL, DraftExport, Invoice } from '../types';
import { getNetAPayerFcfa } from './timbreFiscal';

/**
 * Créances clients — RÈGLE PARTAGÉE UNIQUE (cockpit, tableau de bord).
 *
 * Une « créance réelle » est une facture :
 *  1. **active** : ni ANNULEE, ni remplacée par un AVOIR ;
 *  2. **définitive** : statut VALIDEE (ou numérotation définitive « FA-… ») —
 *     les proformas (BROUILLON) restent des documents de pré-facturation et sont
 *     exposées à part, sans entrer dans le solde dû affiché ;
 *  3. **rattachée** : sa référence (n° de BL, ou n° de draft export pour les
 *     amendements Export) correspond à un BL ou à un draft réellement présent.
 *     Les **factures orphelines** (BL/escale purgés) sont ainsi écartées et ne
 *     gonflent plus artificiellement le solde dû.
 *
 * Assiette : le **Net à payer** (TTC + timbre fiscal d'État). Le timbre n'est
 * volontairement pas fondu dans `montantTtcFcfa` (voir timbreFiscal.ts) alors que
 * le solde dû, lui, l'inclut : comparer TTC et solde fausserait le taux de
 * recouvrement. On utilise donc la même base de part et d'autre.
 */

export interface CreancesSummary {
  /** Factures retenues dans le périmètre des créances fermes. */
  factures: Invoice[];
  /** Assiette : Σ Net à payer (TTC + timbre) des factures retenues. */
  totalNetAPayerFcfa: number;
  /** Encours restant dû : Σ solde des factures retenues. */
  totalSoldeDuFcfa: number;
  /** Déjà encaissé sur le périmètre : Σ (net à payer − solde), borné à 0 par facture. */
  totalEncaisseFcfa: number;
  /** Taux de recouvrement borné 0 → 100. */
  tauxRecouvrement: number;
  /** Nombre de factures du périmètre. */
  nbFactures: number;
  /** Proformas (BROUILLON) actives et rattachées — hors créances fermes (information). */
  nbProformasActives: number;
  soldeProformasFcfa: number;
  /** Factures orphelines écartées (BL/draft inconnu) — traçabilité de la règle. */
  nbOrphelines: number;
  soldeOrphelinesFcfa: number;
}

/** Statuts exclus des créances : facture annulée ou remplacée par un avoir. */
export const isFactureActive = (inv: Invoice): boolean =>
  inv.statutFacture !== 'ANNULEE' && inv.statutFacture !== 'AVOIR';

/** Numérotation définitive d'une facture (les proformas utilisent PROF-/ECH-/…). */
const NUMERO_DEFINITIVE = /^FA-/i;

/** Facture définitive (validée) — les proformas BROUILLON ne sont pas des créances fermes. */
export const isFactureDefinitive = (inv: Invoice): boolean =>
  inv.statutFacture === 'VALIDEE' || NUMERO_DEFINITIVE.test((inv.numeroFacture || '').trim());

/** La référence de la facture correspond-elle à un BL ou à un draft export connus ? */
export function isFactureRattachee(
  inv: Invoice,
  bls: BL[] | undefined | null,
  drafts: DraftExport[] | undefined | null
): boolean {
  const blId = inv.blId;
  if (blId !== undefined && blId !== null) {
    if ((bls || []).some(b => Number(b.id) === Number(blId))) return true;
    if ((drafts || []).some(d => Number(d.id) === Number(blId))) return true;
  }
  const ref = (inv.numeroBL || '').trim();
  if (!ref) return false;
  return (bls || []).some(b => (b.numeroBL || '').trim() === ref)
    || (drafts || []).some(d =>
      (d.numeroBlGenere || '').trim() === ref || (d.numeroDraft || '').trim() === ref
    );
}

/** Synthèse des créances clients d'un lot de factures (périmètre, solde dû, recouvrement). */
export function computeCreances(
  invoices: Invoice[] | undefined | null,
  bls: BL[] | undefined | null,
  drafts: DraftExport[] | undefined | null
): CreancesSummary {
  const factures: Invoice[] = [];
  let nbProformasActives = 0;
  let soldeProformasFcfa = 0;
  let nbOrphelines = 0;
  let soldeOrphelinesFcfa = 0;

  for (const inv of invoices || []) {
    if (!isFactureActive(inv)) continue;
    if (!isFactureRattachee(inv, bls, drafts)) {
      nbOrphelines += 1;
      soldeOrphelinesFcfa += Math.max(0, Number(inv.soldeDuFcfa) || 0);
      continue;
    }
    if (!isFactureDefinitive(inv)) {
      nbProformasActives += 1;
      soldeProformasFcfa += Math.max(0, Number(inv.soldeDuFcfa) || 0);
      continue;
    }
    factures.push(inv);
  }

  let totalNetAPayerFcfa = 0;
  let totalSoldeDuFcfa = 0;
  let totalEncaisseFcfa = 0;

  for (const inv of factures) {
    const net = getNetAPayerFcfa(inv);
    const solde = Math.max(0, Number(inv.soldeDuFcfa) || 0);
    totalNetAPayerFcfa += net;
    totalSoldeDuFcfa += solde;
    totalEncaisseFcfa += Math.max(0, net - solde);
  }

  const tauxRecouvrement = totalNetAPayerFcfa > 0
    ? Math.min(100, Math.max(0, (totalEncaisseFcfa / totalNetAPayerFcfa) * 100))
    : 0;

  return {
    factures,
    totalNetAPayerFcfa,
    totalSoldeDuFcfa,
    totalEncaisseFcfa,
    tauxRecouvrement,
    nbFactures: factures.length,
    nbProformasActives,
    soldeProformasFcfa,
    nbOrphelines,
    soldeOrphelinesFcfa
  };
}
