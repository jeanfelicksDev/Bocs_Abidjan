import { prisma } from './_db.js';

// Helper pour gérer le BigInt
const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
));

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const invoices = await prisma.invoices.findMany({
        where: { deleted_at: null },
        orderBy: { id: 'desc' }
      });

      const items = await prisma.invoice_items.findMany();

      const mappedInvoices = invoices.map((inv: any) => {
        const statutFacture = inv.statut_facture || 'BROUILLON';

        return {
          ...inv,
          id: Number(inv.id),
          blId: Number(inv.bl_id),
          numeroBL: inv.numero_bl,
          clientNom: inv.client_nom,
          escaleInfo: inv.escale_info,
          typeFacture: inv.type_facture,
          numeroFacture: inv.numero_facture,
          dateFacture: inv.date_facture,
          dateEcheance: inv.date_echeance,
          devise: inv.devise,
          tauxChangeUsd: Number(inv.taux_change_usd),
          montantHtFcfa: Number(inv.montant_ht),
          tvaFcfa: Number(inv.tva),
          montantTtcFcfa: Number(inv.montant_ttc),
          soldeDuFcfa: Number(inv.solde_du),
          statutPaiement: inv.statut_paiement,
          invoiceTypeId: inv.invoice_type_id,
          factureOrigineId: inv.facture_origine_id ? Number(inv.facture_origine_id) : undefined,
          avoirId: inv.avoir_id ? Number(inv.avoir_id) : undefined,
          statutFacture,
          motifAnnulation: inv.motif_annulation,
          createdBy: inv.created_by,
          validatedBy: inv.validated_by,
          validatedAt: inv.validated_at,
          cancelledAt: inv.cancelled_at,
          montantTtcAvantTaxeFcfa: inv.montant_ttc_avant_taxe !== null ? Number(inv.montant_ttc_avant_taxe) : undefined,
          taxeAdditionnelleFcfa: Number(inv.taxe_additionnelle),
          taxeAdditionnelleLibelle: inv.taxe_additionnelle_libelle,
          taxeAdditionnelleMode: inv.taxe_additionnelle_mode,
          taxeAdditionnelleValeur: inv.taxe_additionnelle_valeur !== null ? Number(inv.taxe_additionnelle_valeur) : undefined,
          timbreFiscalFcfa: Number(inv.timbre_fiscal),
          isComptant: Boolean(inv.is_comptant),
          modeReglement: inv.mode_reglement,
          lignes: items
            .filter((item: any) => Number(item.invoice_id) === Number(inv.id) && Number(item.quantite) > 0 && Number(item.montant_ht) > 0)
            .map((item: any) => ({
              id: Number(item.id),
              designation: item.designation,
              typeFrais: item.type_frais,
              quantite: Number(item.quantite),
              prixUnitaireFcfa: Number(item.prix_unitaire),
              montantHtFcfa: Number(item.montant_ht),
              tauxTva: Number(item.taux_tva)
            })),
          deletedAt: inv.deleted_at?.toISOString()
        };
      });

      return res.status(200).json({ success: true, invoices: serialize(mappedInvoices) });
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
      await prisma.invoice_items.deleteMany({ where: { invoice_id: invoice.id } });
      await prisma.invoices.deleteMany({ where: { id: invoice.id } });

      const statutFacture = invoice.statutFacture || 'BROUILLON';

      await prisma.invoices.create({
        data: {
          id: invoice.id,
          bl_id: invoice.blId || 0,
          numero_bl: invoice.numeroBL || '',
          client_nom: invoice.clientNom,
          escale_info: invoice.escaleInfo || '',
          type_facture: invoice.typeFacture,
          numero_facture: invoice.numeroFacture,
          date_facture: invoice.dateFacture,
          date_echeance: invoice.dateEcheance,
          devise: invoice.devise || 'FCFA',
          taux_change_usd: invoice.tauxChangeUsd || 600,
          montant_ht: invoice.montantHtFcfa || 0,
          tva: invoice.tvaFcfa || 0,
          montant_ttc: invoice.montantTtcFcfa || 0,
          solde_du: invoice.soldeDuFcfa || 0,
          statut_paiement: invoice.statutPaiement || 'NON_PAYE',
          invoice_type_id: invoice.invoiceTypeId ? String(invoice.invoiceTypeId) : null,
          statut_facture: statutFacture,
          motif_annulation: invoice.motifAnnulation || null,
          facture_origine_id: invoice.factureOrigineId || null,
          avoir_id: invoice.avoirId || null,
          created_by: invoice.createdBy || null,
          validated_by: invoice.validatedBy || null,
          validated_at: invoice.validatedAt || null,
          cancelled_at: invoice.cancelledAt || null,
          montant_ttc_avant_taxe: invoice.montantTtcAvantTaxeFcfa ?? null,
          taxe_additionnelle: invoice.taxeAdditionnelleFcfa || 0,
          taxe_additionnelle_libelle: invoice.taxeAdditionnelleLibelle || null,
          taxe_additionnelle_mode: invoice.taxeAdditionnelleMode || null,
          taxe_additionnelle_valeur: invoice.taxeAdditionnelleValeur ?? null,
          timbre_fiscal: invoice.timbreFiscalFcfa || 0,
          is_comptant: invoice.isComptant === true,
          mode_reglement: invoice.modeReglement || null
        }
      });

      if (invoice.lignes && invoice.lignes.length > 0) {
        const itemsToInsert = invoice.lignes
          .filter((line: any) => line.designation && Number(line.quantite) > 0 && Number(line.montantHtFcfa) > 0)
          .map((line: any) => ({
            invoice_id: invoice.id,
            designation: line.designation,
            type_frais: line.typeFrais || 'AUTRE',
            quantite: line.quantite,
            prix_unitaire: line.prixUnitaireFcfa,
            montant_ht: line.montantHtFcfa,
            taux_tva: line.tauxTva || 18
          }));
        if (itemsToInsert.length > 0) {
          await prisma.invoice_items.createMany({ data: itemsToInsert });
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

      const existing = await prisma.invoices.findUnique({
        where: { id: invoiceId },
        select: { id: true, bl_id: true, statut_facture: true, numero_facture: true, statut_paiement: true, solde_du: true }
      });

      if (existing) {
        const hasPayment = Number(existing.solde_du) === 0 ||
                           existing.statut_paiement === 'PAYE' ||
                           existing.statut_paiement === 'PARTIEL';
        const isProforma = !(existing.numero_facture || '').startsWith('FA-') && 
                           existing.statut_facture !== 'VALIDEE' && 
                           existing.statut_facture !== 'ANNULEE' && 
                           existing.statut_facture !== 'AVOIR' && 
                           !hasPayment;
        if (!isProforma) {
          return res.status(403).json({
            success: false,
            error: `Conformité fiscale : Seules les factures proforma non réglées peuvent être supprimées. La facture ${existing.numero_facture} est inaltérable. Vous devez émettre un Avoir pour l'annuler.`
          });
        }
      }

      await prisma.payments.deleteMany({ where: { facture_id: invoiceId } });
      
      const creditNotes = await prisma.credit_notes.findMany({
        where: { facture_id: invoiceId },
        select: { id: true }
      });
      const cnIds = creditNotes.map(c => c.id);
      
      if (cnIds.length > 0) {
        await prisma.credit_note_items.deleteMany({ where: { credit_note_id: { in: cnIds } } });
        await prisma.credit_notes.deleteMany({ where: { facture_id: invoiceId } });
      }
      
      await prisma.invoice_items.deleteMany({ where: { invoice_id: invoiceId } });
      await prisma.invoices.delete({ where: { id: invoiceId } });

      if (existing && existing.bl_id) {
        const count = await prisma.invoices.count({ where: { bl_id: existing.bl_id } });
        if (count === 0) {
          await prisma.bls.update({
            where: { id: existing.bl_id },
            data: { statut_import: 'EN_ATTENTE', cachet_agent_appose: false, date_signature: null, hash_signature: null }
          });
        }
      }

      return res.status(200).json({ success: true, message: "Facture proforma et toutes les pièces rattachées supprimées avec succès." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
