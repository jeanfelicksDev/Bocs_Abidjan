import type { Invoice } from '../types';

/** Types numériques et statut par défaut d'une facture reçue de l'API (Neon renvoie des chaînes). */
export const normalizeInvoice = (inv: Invoice): Invoice => {
  const soldeDuFcfa = Number(inv.soldeDuFcfa || 0);
  const montantTtcFcfa = Number(inv.montantTtcFcfa || 0);
  // Validation explicite uniquement (handleValidateInvoice) : aucun statut dérivé
  // (ni FA-, ni PAYE, ni PARTIEL) ne doit auto-promouvoir une proforma en VALIDEE.
  const statutFacture = inv.statutFacture || 'BROUILLON';
  return {
    ...inv,
    id: Number(inv.id),
    blId: inv.blId ? Number(inv.blId) : undefined,
    clientId: inv.clientId ? Number(inv.clientId) : undefined,
    tauxChangeUsd: Number(inv.tauxChangeUsd || 600),
    montantHtFcfa: Number(inv.montantHtFcfa || 0),
    tvaFcfa: Number(inv.tvaFcfa || 0),
    montantTtcFcfa,
    soldeDuFcfa,
    // Taxe additionnelle exceptionnelle (assiette TTC) — historique figé à l'émission
    montantTtcAvantTaxeFcfa: inv.montantTtcAvantTaxeFcfa !== undefined && inv.montantTtcAvantTaxeFcfa !== null
      ? Number(inv.montantTtcAvantTaxeFcfa)
      : undefined,
    taxeAdditionnelleFcfa: Number(inv.taxeAdditionnelleFcfa || 0),
    taxeAdditionnelleLibelle: inv.taxeAdditionnelleLibelle || undefined,
    taxeAdditionnelleMode: inv.taxeAdditionnelleMode || undefined,
    taxeAdditionnelleValeur: inv.taxeAdditionnelleValeur !== undefined && inv.taxeAdditionnelleValeur !== null
      ? Number(inv.taxeAdditionnelleValeur)
      : undefined,
    invoiceTypeId: inv.invoiceTypeId ? String(inv.invoiceTypeId) : undefined,
    statutFacture,
    lignes: (inv.lignes || []).map(line => ({
      ...line,
      id: line.id ? Number(line.id) : undefined,
      quantite: Number(line.quantite || 0),
      prixUnitaireFcfa: Number(line.prixUnitaireFcfa || 0),
      montantHtFcfa: Number(line.montantHtFcfa || 0),
      tauxTva: Number(line.tauxTva || 18)
    }))
  };
};
