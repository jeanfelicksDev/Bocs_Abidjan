import { prisma } from './_db.js';

// Helper pour gérer le BigInt
const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
));

const toNumberOrNull = (value: any): number | null =>
  value === null || value === undefined || value === '' ? null : Number(value);

const toNumberOrUndefined = (value: any): number | undefined => {
  const n = toNumberOrNull(value);
  return n === null || isNaN(n) ? undefined : n;
};

// Prisma (snake_case) -> Application (camelCase)
function mapDraft(d: any) {
  return {
    ...d,
    id: Number(d.id),
    clientId: toNumberOrUndefined(d.client_id),
    clientNom: d.client_nom,
    clientSociete: d.client_societe ?? undefined,
    clientEmail: d.client_email ?? undefined,
    escaleId: toNumberOrUndefined(d.escale_id),
    numeroDraft: d.numero_draft,
    bookingRef: d.booking_ref ?? undefined,
    navireNom: d.navire_nom ?? undefined,
    numeroVoyage: d.numero_voyage ?? undefined,
    portChargementCode: d.port_chargement_code ?? undefined,
    portDechargementCode: d.port_dechargement_code ?? undefined,
    portDechargementNom: d.port_dechargement_nom ?? undefined,
    shipperInfo: d.shipper_info ?? { nom: '', adresse: '', pays: '' },
    consigneeInfo: d.consignee_info ?? { nom: '', adresse: '', pays: '' },
    notifyInfo: d.notify_info ?? { nom: '', adresse: '', pays: '' },
    marchandisesInfo: d.marchandises_info ?? { description: '', poidsBrutKg: 0, volumeM3: 0, nombreColis: 0, typeEmballage: '' },
    conteneursInfo: Array.isArray(d.conteneurs_info) ? d.conteneurs_info : [],
    statut: d.statut,
    motifDemandeModification: d.motif_demande_modification ?? undefined,
    dateCreation: d.date_creation,
    dateValidation: d.date_validation ?? undefined,
    numeroBlGenere: d.numero_bl_genere ?? undefined,
    dateLimiteTransmission: d.date_limite_transmission ?? undefined,
    estDeverrouille: Boolean(d.est_deverrouille),
    dateLimiteCorrection: d.date_limite_correction ?? undefined,
    verrouilleApresCorrection: Boolean(d.verrouille_apres_correction),
    okToPrint: Boolean(d.ok_to_print),
    contenuOriginal: d.contenu_original ?? undefined,
    demandeCorrection: d.demande_correction ?? undefined,
    fraisAmendementFactures: Boolean(d.frais_amendement_factures),
    factureFraisId: toNumberOrUndefined(d.facture_frais_id)
  };
}

// Application (camelCase) -> Prisma (snake_case)
function toDraftData(draft: any) {
  return {
    id: Number(draft.id),
    client_id: toNumberOrNull(draft.clientId),
    client_nom: draft.clientNom || 'Client export',
    client_societe: draft.clientSociete || null,
    client_email: draft.clientEmail || null,
    escale_id: toNumberOrNull(draft.escaleId),
    numero_draft: draft.numeroDraft || `BOCS-EXP-DRF-${Date.now()}`,
    booking_ref: draft.bookingRef || null,
    navire_nom: draft.navireNom || null,
    numero_voyage: draft.numeroVoyage || null,
    port_chargement_code: draft.portChargementCode || null,
    port_dechargement_code: draft.portDechargementCode || null,
    port_dechargement_nom: draft.portDechargementNom || null,
    shipper_info: draft.shipperInfo ?? {},
    consignee_info: draft.consigneeInfo ?? {},
    notify_info: draft.notifyInfo ?? {},
    marchandises_info: draft.marchandisesInfo ?? {},
    conteneurs_info: Array.isArray(draft.conteneursInfo) ? draft.conteneursInfo : [],
    statut: draft.statut || 'BROUILLON',
    motif_demande_modification: draft.motifDemandeModification || null,
    date_creation: draft.dateCreation || new Date().toISOString().split('T')[0],
    date_validation: draft.dateValidation || null,
    numero_bl_genere: draft.numeroBlGenere || null,
    date_limite_transmission: draft.dateLimiteTransmission || null,
    est_deverrouille: draft.estDeverrouille ?? false,
    date_limite_correction: draft.dateLimiteCorrection || null,
    verrouille_apres_correction: draft.verrouilleApresCorrection ?? false,
    ok_to_print: draft.okToPrint ?? false,
    contenu_original: draft.contenuOriginal || null,
    demande_correction: draft.demandeCorrection ?? undefined,
    frais_amendement_factures: draft.fraisAmendementFactures ?? false,
    facture_frais_id: toNumberOrNull(draft.factureFraisId)
  };
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const drafts = await prisma.draft_exports.findMany({
        orderBy: [
          { date_creation: 'desc' },
          { id: 'desc' }
        ]
      });

      return res.status(200).json({ success: true, drafts: serialize(drafts.map(mapDraft)) });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const data = req.body;
      const draftsList = Array.isArray(data?.drafts) ? data.drafts : (data?.id ? [data] : []);

      if (draftsList.length === 0) {
        return res.status(400).json({ success: false, error: "No drafts provided." });
      }

      const draftIds = draftsList
        .map((d: any) => Number(d.id))
        .filter((id: number) => !isNaN(id));

      // Remplacement complet (delete + create) : évite tout résidu lors d'un
      // changement de statut (contenuOriginal, demandeCorrection, etc.).
      if (draftIds.length > 0) {
        await prisma.draft_exports.deleteMany({ where: { id: { in: draftIds } } });
      }

      const draftsToInsert = draftsList.map(toDraftData);
      await prisma.draft_exports.createMany({ data: draftsToInsert });

      return res.status(200).json({ success: true, message: `${draftsList.length} draft(s) sauvegardé(s) avec succès.` });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const rawId = req.query?.id || req.body?.id;

      if (rawId === 'ALL') {
        await prisma.draft_exports.deleteMany();
        return res.status(200).json({ success: true, message: "Tous les drafts export ont été supprimés." });
      }

      const draftId = Number(rawId);
      if (!rawId || isNaN(draftId)) {
        return res.status(400).json({ success: false, error: "Missing or invalid draft ID." });
      }

      await prisma.draft_exports.deleteMany({ where: { id: draftId } });
      return res.status(200).json({ success: true, message: `Draft ${draftId} supprimé.` });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }
}
