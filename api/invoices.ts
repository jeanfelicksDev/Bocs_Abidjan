import { sql } from './db';

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
          invoice_type_id as "invoiceTypeId"
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
        return {
          ...inv,
          id: Number(inv.id),
          blId: Number(inv.blId),
          lignes: items
            .filter((item: any) => Number(item.invoiceId) === Number(inv.id))
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

      // Insert invoice
      await sql`
        INSERT INTO invoices (
          id, bl_id, numero_bl, client_nom, escale_info, type_facture, 
          numero_facture, date_facture, date_echeance, devise, 
          taux_change_usd, montant_ht, tva, montant_ttc, solde_du, statut_paiement, invoice_type_id
        ) VALUES (
          ${invoice.id}, ${invoice.blId}, ${invoice.numeroBL}, ${invoice.clientNom}, ${invoice.escaleInfo}, ${invoice.typeFacture},
          ${invoice.numeroFacture}, ${invoice.dateFacture}, ${invoice.dateEcheance}, ${invoice.devise},
          ${invoice.tauxChangeUsd}, ${invoice.montantHtFcfa}, ${invoice.tvaFcfa}, ${invoice.montantTtcFcfa}, ${invoice.soldeDuFcfa}, ${invoice.statutPaiement}, ${invoice.invoiceTypeId || null}
        );
      `;

      // Insert lines
      if (invoice.lignes && invoice.lignes.length > 0) {
        for (const line of invoice.lignes) {
          await sql`
            INSERT INTO invoice_items (
              invoice_id, designation, type_frais, quantite, prix_unitaire, montant_ht, taux_tva
            ) VALUES (
              ${invoice.id}, ${line.designation}, ${line.typeFrais}, ${line.quantite}, ${line.prixUnitaireFcfa}, ${line.montantHtFcfa}, ${line.tauxTva}
            );
          `;
        }
      }

      return res.status(200).json({ success: true, message: "Invoice saved successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
