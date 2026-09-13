import { sql } from './_db.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const creditNotes = await sql`
        SELECT 
          id,
          numero_avoir as "numeroAvoir",
          facture_id as "factureId",
          numero_facture_origine as "numeroFactureOrigine",
          client_nom as "clientNom",
          motif,
          date_emission as "dateEmission",
          montant_ht as "montantHtFcfa",
          tva as "tvaFcfa",
          montant_ttc as "montantTtcFcfa",
          statut,
          created_by as "createdBy"
        FROM credit_notes
        ORDER BY id DESC;
      `;

      const items = await sql`
        SELECT 
          id,
          credit_note_id as "creditNoteId",
          designation,
          type_frais as "typeFrais",
          quantite,
          prix_unitaire as "prixUnitaireFcfa",
          montant_ht as "montantHtFcfa",
          taux_tva as "tauxTva"
        FROM credit_note_items;
      `;

      const mappedCreditNotes = creditNotes.map((cn: any) => {
        return {
          ...cn,
          id: Number(cn.id),
          factureId: Number(cn.factureId),
          montantHtFcfa: Number(cn.montantHtFcfa),
          tvaFcfa: Number(cn.tvaFcfa),
          montantTtcFcfa: Number(cn.montantTtcFcfa),
          lignes: items
            .filter((item: any) => Number(item.creditNoteId) === Number(cn.id))
            .map((item: any) => ({
              id: item.id,
              creditNoteId: Number(item.creditNoteId),
              designation: item.designation,
              typeFrais: item.typeFrais,
              quantite: Number(item.quantite),
              prixUnitaireFcfa: Number(item.prixUnitaireFcfa),
              montantHtFcfa: Number(item.montantHtFcfa),
              tauxTva: Number(item.tauxTva)
            }))
        };
      });

      return res.status(200).json({ success: true, creditNotes: mappedCreditNotes });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const creditNote = req.body;
      if (!creditNote || !creditNote.factureId || !creditNote.motif) {
        return res.status(400).json({ success: false, error: "Informations d'avoir incomplètes ou motif manquant." });
      }

      // Upsert/Insert Credit Note
      await sql`DELETE FROM credit_note_items WHERE credit_note_id = ${creditNote.id};`;
      await sql`DELETE FROM credit_notes WHERE id = ${creditNote.id};`;

      await sql`
        INSERT INTO credit_notes (
          id, numero_avoir, facture_id, numero_facture_origine, client_nom,
          motif, date_emission, montant_ht, tva, montant_ttc, statut, created_by
        ) VALUES (
          ${creditNote.id}, ${creditNote.numeroAvoir}, ${creditNote.factureId},
          ${creditNote.numeroFactureOrigine}, ${creditNote.clientNom}, ${creditNote.motif},
          ${creditNote.dateEmission}, ${creditNote.montantHtFcfa || 0}, ${creditNote.tvaFcfa || 0},
          ${creditNote.montantTtcFcfa || 0}, ${creditNote.statut || 'VALIDE'}, ${creditNote.createdBy || ''}
        );
      `;

      // Insert credit note items
      if (creditNote.lignes && creditNote.lignes.length > 0) {
        for (const line of creditNote.lignes) {
          await sql`
            INSERT INTO credit_note_items (
              credit_note_id, designation, type_frais, quantite, prix_unitaire, montant_ht, taux_tva
            ) VALUES (
              ${creditNote.id}, ${line.designation}, ${line.typeFrais},
              ${line.quantite}, ${line.prixUnitaireFcfa}, ${line.montantHtFcfa}, ${line.tauxTva}
            );
          `;
        }
      }

      // Automatically update source invoice to 'ANNULEE' status
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
      await sql`
        UPDATE invoices 
        SET 
          statut_facture = 'ANNULEE',
          motif_annulation = ${creditNote.motif},
          avoir_id = ${creditNote.id},
          cancelled_at = ${nowIso},
          solde_du = 0
        WHERE id = ${creditNote.factureId};
      `;

      return res.status(200).json({ success: true, message: "Avoir émis avec succès et facture d'origine annulée." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    // Interdiction stricte de suppression d'avoir pour respecter les normes fiscales
    return res.status(403).json({ 
      success: false, 
      error: "Conformité fiscale : Une note d'avoir émise et enregistrée est inaltérable et ne peut être supprimée de la base de données." 
    });
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
