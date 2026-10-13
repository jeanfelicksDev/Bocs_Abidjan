import { prisma } from './_db.js';

const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
));

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const creditNotes = await prisma.credit_notes.findMany({
        orderBy: { id: 'desc' }
      });
      const items = await prisma.credit_note_items.findMany();

      const mappedCreditNotes = creditNotes.map((cn: any) => ({
        ...cn,
        id: Number(cn.id),
        numeroAvoir: cn.numero_avoir,
        factureId: Number(cn.facture_id),
        numeroFactureOrigine: cn.numero_facture_origine,
        clientNom: cn.client_nom,
        dateEmission: cn.date_emission,
        montantHtFcfa: Number(cn.montant_ht),
        tvaFcfa: Number(cn.tva),
        montantTtcFcfa: Number(cn.montant_ttc),
        createdBy: cn.created_by,
        lignes: items
          .filter((item: any) => Number(item.credit_note_id) === Number(cn.id))
          .map((item: any) => ({
            id: Number(item.id),
            creditNoteId: Number(item.credit_note_id),
            designation: item.designation,
            typeFrais: item.type_frais,
            quantite: Number(item.quantite),
            prixUnitaireFcfa: Number(item.prix_unitaire),
            montantHtFcfa: Number(item.montant_ht),
            tauxTva: Number(item.taux_tva)
          })),
        deletedAt: cn.deleted_at?.toISOString()
      }));

      return res.status(200).json({ success: true, creditNotes: serialize(mappedCreditNotes) });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const creditNote = req.body;
      if (!creditNote || !creditNote.factureId || !creditNote.motif) {
        return res.status(400).json({ success: false, error: "Informations d'avoir incomplètes ou motif manquant." });
      }

      await prisma.credit_note_items.deleteMany({ where: { credit_note_id: creditNote.id } });
      await prisma.credit_notes.deleteMany({ where: { id: creditNote.id } });

      await prisma.credit_notes.create({
        data: {
          id: creditNote.id,
          numero_avoir: creditNote.numeroAvoir,
          facture_id: creditNote.factureId,
          numero_facture_origine: creditNote.numeroFactureOrigine,
          client_nom: creditNote.clientNom,
          motif: creditNote.motif,
          date_emission: creditNote.dateEmission,
          montant_ht: creditNote.montantHtFcfa || 0,
          tva: creditNote.tvaFcfa || 0,
          montant_ttc: creditNote.montantTtcFcfa || 0,
          statut: creditNote.statut || 'VALIDE',
          created_by: creditNote.createdBy || ''
        }
      });

      if (creditNote.lignes && creditNote.lignes.length > 0) {
        const itemsToInsert = creditNote.lignes.map((line: any) => ({
          credit_note_id: creditNote.id,
          designation: line.designation,
          type_frais: line.typeFrais,
          quantite: line.quantite,
          prix_unitaire: line.prixUnitaireFcfa,
          montant_ht: line.montantHtFcfa,
          taux_tva: line.tauxTva
        }));
        await prisma.credit_note_items.createMany({ data: itemsToInsert });
      }

      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
      await prisma.invoices.update({
        where: { id: creditNote.factureId },
        data: {
          statut_facture: 'ANNULEE',
          motif_annulation: creditNote.motif,
          avoir_id: creditNote.id,
          cancelled_at: nowIso,
          solde_du: 0
        }
      });

      return res.status(200).json({ success: true, message: "Avoir émis avec succès et facture d'origine annulée." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    return res.status(403).json({ 
      success: false, 
      error: "Conformité fiscale : Une note d'avoir émise et enregistrée est inaltérable et ne peut être supprimée de la base de données." 
    });
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
