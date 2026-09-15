import type { Invoice, TimbreBracket } from '../types';

/**
 * Timbre fiscal d'État — assiette : MONTANT HT de la facture.
 *
 * Règles BOCS :
 *  - Le timbre est paramétrable par tranches de montant HT (TimbreBracket) : chaque
 *    tranche active définit le montant du timbre applicable (100 FCFA par défaut).
 *  - Conformément à la précision utilisateur, le timbre s'applique au Net à Payer
 *    quel que soit le mode de règlement (comptant, virement, chèque, à terme…).
 *  - Chaque facture conserve le montant de timbre appliqué lors de son émission
 *    (champ `timbreFiscalFcfa`) : modifier les tranches ensuite n'affecte que les
 *    factures émises par la suite.
 *  - Le recalcul est idempotent : le solde dû est ajusté du *delta* de timbre, donc
 *    régénérer ou modifier une facture ne cumule jamais le timbre plusieurs fois.
 */

export const TIMBRE_FISCAL_LIBELLE = "Timbre fiscal d'État";

/** Liste ordonnée des modes de règlement proposés à l'émission d'une facture. */
export const MODES_REGLEMENT = ['COMPTANT', 'A_TERME', 'VIREMENT', 'CHEQUE', 'ESPECES'] as const;
export type ModeReglement = (typeof MODES_REGLEMENT)[number];

/** Libellé lisible d'un mode de règlement (écran / PDF). */
export function getModeReglementLabel(mode?: ModeReglement | string): string {
  switch (mode) {
    case 'COMPTANT': return 'Règlement au comptant';
    case 'ESPECES': return 'Espèces (caisse)';
    case 'VIREMENT': return 'Virement bancaire';
    case 'CHEQUE': return 'Chèque';
    case 'A_TERME': return 'À terme';
    default: return 'À terme';
  }
}

/** Renvoie la tranche active correspondant au montant HT donné (déterministe). */
export function findTimbreBracket(
  brackets: TimbreBracket[] | undefined | null,
  montantHtFcfa: number
): TimbreBracket | undefined {
  const ht = Math.max(0, Math.round(Number(montantHtFcfa) || 0));
  const actives = (brackets || [])
    .filter(b => b && b.estActif !== false)
    .sort((a, b) => (Number(a.montantHtMin) || 0) - (Number(b.montantHtMin) || 0));
  return actives.find(b => {
    const min = Math.max(0, Number(b.montantHtMin) || 0);
    const max = Number(b.montantHtMax);
    // Borne supérieure EXCLUSIVE : à la frontière, le montant bascule dans la tranche supérieure
    // (ex. tranche [0; 500000[ puis [500000; 5000000[).
    const maxOk = Number.isFinite(max) && max > 0 ? ht < max : true;
    return ht >= min && maxOk;
  });
}

/**
 * Montant du timbre fiscal applicable au montant HT donné.
 * 0 si aucune tranche active ne couvre le montant HT.
 */
export function computeTimbreFiscal(
  brackets: TimbreBracket[] | undefined | null,
  montantHtFcfa: number
): number {
  const bracket = findTimbreBracket(brackets, montantHtFcfa);
  if (!bracket) return 0;
  return Math.max(0, Math.round(Number(bracket.montantTimbreFcfa) || 0));
}

/** Net à payer d'une facture : montant TTC (+ taxe additionnelle) + timbre fiscal. */
export function getNetAPayerFcfa(invoice: Invoice): number {
  const ttc = Math.max(0, Number(invoice.montantTtcFcfa) || 0);
  const timbre = Math.max(0, Number(invoice.timbreFiscalFcfa) || 0);
  return ttc + timbre;
}

/**
 * Applique (ou retire) le timbre fiscal d'État sur une facture selon les tranches courantes.
 * Idempotent : le solde dû suit la variation du timbre (préserve les règlements encaissés).
 */
export function applyTimbreFiscalToInvoice(
  invoice: Invoice,
  brackets: TimbreBracket[] | undefined | null
): Invoice {
  const nouveauTimbre = computeTimbreFiscal(brackets, invoice.montantHtFcfa);
  const ancienTimbre = Number(invoice.timbreFiscalFcfa) || 0;
  if (nouveauTimbre === ancienTimbre) return invoice;

  const solde = Number(invoice.soldeDuFcfa);
  const soldeBase = Number.isFinite(solde) ? solde : Math.max(0, Number(invoice.montantTtcFcfa) || 0);
  const nouveauSolde = Math.max(0, soldeBase - ancienTimbre + nouveauTimbre);

  return { ...invoice, timbreFiscalFcfa: nouveauTimbre, soldeDuFcfa: nouveauSolde };
}

/** Détail lisible du timbre appliqué sur une facture (ex. « 100 FCFA »). */
export function getTimbreFiscalValeurLabel(timbreFiscalFcfa?: number): string {
  const v = Math.max(0, Number(timbreFiscalFcfa) || 0);
  return `${v.toLocaleString('fr-FR')} FCFA`;
}