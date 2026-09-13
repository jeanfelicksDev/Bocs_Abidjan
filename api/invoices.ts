import { sql } from './_db.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const invoices = await sql`
        SELECT 
          id, 
          bl_id as "blId", 
          numero_bl as "numeroBL", 
          client_nom as "clientNom", 
          escale_info as "escaleInfo", 
          type_facture as "typeFacture", 
          numero_facture as "numeroFacture", 
          date_facture as "dateFacture", 
          date_echeance as "dateEcheance", 
          devise, 
          taux_change_usd as "tauxChangeUsd", 
          montant_ht as "montantHtFcfa", 
          tva as "tvaFcfa", 
          montant_ttc as "montantTtcFcfa", 
          solde_du as "soldeDuFcfa", 
          statut_paiement as "statutPaiement",
          invoice_type_id as "invoiceTypeId",
          statut_facture as "statutFacture",
          motif_annulation as "motifAnnulation",
          facture_origine_id as "factureOrigineId",
          avoir_id as "avoirId",
          created_by as "createdBy",
          validated_by as "validatedBy",
          validated_at as "validatedAt",
          cancelled_at as "cancelledAt"
        FROM invoices 
        ORDER BY id DESC;
      `;

      const items = await sql`
        SELECT 
          id, 
          invoice_id as "invoiceId", 
          designation, 
          type_frais as "typeFrais", 
          quantite, 
          prix_unitaire as "prixUnitaireFcfa", 
          montant_ht as "montantHtFcfa", 
          taux_tva as "tauxTva"
        FROM invoice_items;
      `;

      const mappedInvoices = invoices.map((inv: any) => {
        const rawStatus = inv.statutFacture || 'BROUILLON';
        const isPaid = Number(inv.soldeDuFcfa) === 0 || inv.statutPaiement === 'PAYE';
        const isDefinitive = Boolean(inv.numeroFacture && inv.numeroFacture.startsWith('FA-'));
        const isPartial = inv.statutPaiement === 'PARTIEL';
        let statutFacture = rawStatus;
        if (rawStatus !== 'ANNULEE' && rawStatus !== 'AVOIR' && (isPaid || isDefinitive || isPartial)) {
          statutFacture = 'VALIDEE';
        }

        return {
          ...inv,
          id: Number(inv.id),
          blId: Number(inv.blId),
          factureOrigineId: inv.factureOrigineId ? Number(inv.factureOrigineId) : undefined,
          avoirId: inv.avoirId ? Number(inv.avoirId) : undefined,
          statutFacture,
          lignes: items
            .filter((item: any) => Number(item.invoiceId) === Number(inv.id) && Number(item.quantite) > 0 && Number(item.montantHtFcfa) > 0)
            .map((item: any) => ({
              id: item.id,
              designation: item.designation,
              typeFrais: item.typeFrais,
              quantite: Number(item.quantite),
              prixUnitaireFcfa: Number(item.prixUnitaireFcfa),
              montantHtFcfa: Number(item.montantHtFcfa),
              tauxTva: Number(item.tauxTva)
            }))
        };
      });

      return res.status(200).json({ success: true, invoices: mappedInvoices });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const invoice = req.body;
      if (!invoice) {
        return res.status(400).json({ success: false, error: "Missing invoice object." });
      }

      // Clear existing to support upsert
      await sql`DELETE FROM invoice_items WHERE invoice_id = ${invoice.id};`;
      await sql`DELETE FROM invoices WHERE id = ${invoice.id};`;

      let statutFacture = invoice.statutFacture || 'BROUILLON';
      const isPaid = Number(invoice.soldeDuFcfa) === 0 || invoice.statutPaiement === 'PAYE';
      const isDefinitive = Boolean(invoice.numeroFacture && invoice.numeroFacture.startsWith('FA-'));
      const isPartial = invoice.statutPaiement === 'PARTIEL';
      if (statutFacture !== 'ANNULEE' && statutFacture !== 'AVOIR' && (isPaid || isDefinitive || isPartial)) {
        statutFacture = 'VALIDEE';
      }

      // Insert invoice
      await sql`
        INSERT INTO invoices (
          id, bl_id, numero_bl, client_nom, escale_info, type_facture, 
          numero_facture, date_facture, date_echeance, devise, 
          taux_change_usd, montant_ht, tva, montant_ttc, solde_du, statut_paiement, invoice_type_id,
          statut_facture, motif_annulation, facture_origine_id, avoir_id,
          created_by, validated_by, validated_at, cancelled_at
        ) VALUES (
          ${invoice.id}, ${invoice.blId || 0}, ${invoice.numeroBL || ''}, ${invoice.clientNom}, ${invoice.escaleInfo || ''}, ${invoice.typeFacture},
          ${invoice.numeroFacture}, ${invoice.dateFacture}, ${invoice.dateEcheance}, ${invoice.devise || 'FCFA'},
          ${invoice.tauxChangeUsd || 600}, ${invoice.montantHtFcfa || 0}, ${invoice.tvaFcfa || 0}, ${invoice.montantTtcFcfa || 0},
          ${invoice.soldeDuFcfa || 0}, ${invoice.statutPaiement || 'NON_PAYE'}, ${invoice.invoiceTypeId || null},
          ${statutFacture}, ${invoice.motifAnnulation || null},
          ${invoice.factureOrigineId || null}, ${invoice.avoirId || null},
          ${invoice.createdBy || null}, ${invoice.validatedBy || null},
          ${invoice.validatedAt || null}, ${invoice.cancelledAt || null}
        );
      `;

      // Insert lines
      if (invoice.lignes && invoice.lignes.length > 0) {
        for (const line of invoice.lignes) {
          if (!line.designation || Number(line.quantite) <= 0 || Number(line.montantHtFcfa) <= 0) continue;
          await sql`
            INSERT INTO invoice_items (
              invoice_id, designation, type_frais, quantite, prix_unitaire, montant_ht, taux_tva
            ) VALUES (
              ${invoice.id}, ${line.designation}, ${line.typeFrais || 'AUTRE'}, ${line.quantite}, ${line.prixUnitaireFcfa}, ${line.montantHtFcfa}, ${line.tauxTva || 18}
            );
          `;
        }
      }

      return res.status(200).json({ success: true, message: "Invoice saved successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const rawId = req.query.id || req.body?.id;
      const invoiceId = Number(rawId);
      if (!rawId || isNaN(invoiceId)) {
        return res.status(400).json({ success: false, error: "ID de facture manquant ou invalide." });
      }

      // Check current invoice status and BL ID
      const existing = await sql`SELECT id, bl_id, statut_facture, numero_facture, statut_paiement FROM invoices WHERE id = ${invoiceId};`;
      if (existing.length > 0) {
        const inv = existing[0];
        const isProforma = !(inv.numero_facture || '').startsWith('FA-') && 
                           inv.statut_facture !== 'VALIDEE' && 
                           inv.statut_facture !== 'ANNULEE' && 
                           inv.statut_facture !== 'AVOIR' && 
                           inv.statut_paiement !== 'PAYE';
        if (!isProforma) {
          return res.status(403).json({
            success: false,
            error: `Conformité fiscale : Seules les factures proforma non réglées peuvent être supprimées. La facture ${inv.numero_facture} est inaltérable. Vous devez émettre un Avoir pour l'annuler.`
          });
        }
      }

      // Cascade deletion of all attached pieces
      await sql`DELETE FROM payments WHERE facture_id = ${invoiceId};`;
      await sql`DELETE FROM credit_note_items WHERE credit_note_id IN (SELECT id FROM credit_notes WHERE facture_id = ${invoiceId});`;
      await sql`DELETE FROM credit_notes WHERE facture_id = ${invoiceId};`;
      await sql`DELETE FROM invoice_items WHERE invoice_id = ${invoiceId};`;
      await sql`DELETE FROM invoices WHERE id = ${invoiceId};`;

      // If the BL has no other remaining invoices, reset its status to EN_ATTENTE
      if (existing.length > 0 && existing[0].bl_id) {
        const blId = Number(existing[0].bl_id);
        const remainingInvoices = await sql`SELECT COUNT(*)::int as count FROM invoices WHERE bl_id = ${blId};`;
        const count = remainingInvoices && remainingInvoices[0] ? Number(remainingInvoices[0].count) : 0;
        if (count === 0) {
          await sql`UPDATE bls SET statut_import = 'EN_ATTENTE', cachet_agent_appose = false, date_signature = NULL, hash_signature = NULL WHERE id = ${blId};`;
        }
      }

      return res.status(200).json({ success: true, message: "Facture proforma et toutes les pièces rattachées supprimées avec succès." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
