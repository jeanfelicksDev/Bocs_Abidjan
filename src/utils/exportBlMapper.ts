import { BL, Container, DraftExport } from '../types';

/**
 * BLs d'export réels = connaissements émis depuis les drafts export validés.
 *
 * Dans le modèle de données, un connaissement export n'existe pas comme objet `BL`
 * classique (les manifestes importés créent des BL import) : il est matérialisé par
 * un DraftExport validé par l'Agent Export (statut VALIDE / BL_GENERE / FACTURE)
 * portant un numéro de BL généré (numeroBlGenere, ex. BOCS-EXP-25586-001).
 * Ce module convertit ces drafts en objets BL exploitables par la facturation.
 */

/** Un draft export matérialise un BL réel dès qu'il a été validé (BL généré / facturé). */
export function isValidatedExportDraft(draft: DraftExport): boolean {
  return (
    draft.statut === 'VALIDE' ||
    draft.statut === 'BL_GENERE' ||
    draft.statut === 'FACTURE' ||
    Boolean(draft.numeroBlGenere)
  );
}

/**
 * Convertit un draft export validé en objet BL (typeOperation EXPORT).
 * Les identifiants sont négatifs (univers distinct des BL import) pour éviter
 * toute collision avec les BL issus des manifestes.
 */
export function mapDraftToExportBl(draft: DraftExport): BL {
  const blId = -Math.abs(draft.id);
  return {
    id: blId,
    escaleId: draft.escaleId ?? 0,
    numeroBL: draft.numeroBlGenere || draft.numeroDraft,
    typeOperation: 'EXPORT',
    shipperNom: draft.shipperInfo.nom,
    shipperAdresse: draft.shipperInfo.adresse,
    consigneeNom: draft.consigneeInfo.nom,
    consigneeAdresse: draft.consigneeInfo.adresse,
    notifyNom: draft.notifyInfo.nom,
    notifyAdresse: draft.notifyInfo.adresse,
    portChargementCode: draft.portChargementCode || '',
    portDechargementCode: draft.portDechargementCode || '',
    destinationFinale: draft.portDechargementNom || '',
    descriptionGoods: draft.marchandisesInfo.description,
    nombreColis: draft.marchandisesInfo.nombreColis,
    typeEmballage: draft.marchandisesInfo.typeEmballage,
    poidsBrutKg: draft.marchandisesInfo.poidsBrutKg,
    volumeM3: draft.marchandisesInfo.volumeM3,
    clientId: draft.clientId,
    conteneurs: draft.conteneursInfo.map((c, i): Container => ({
      id: blId * 100 - i,
      blId,
      numeroConteneur: c.numeroConteneur,
      typeConteneur: c.typeConteneur,
      numeroScelle: c.numeroScelle,
      poidsKg: c.poidsKg,
      poidsNetKg: c.poidsNetKg,
      volumeM3: c.volumeM3,
      tareKg: c.tareKg,
      nombreColis: c.nombreColis,
      montantCautionFcfa: 0
    }))
  };
}
