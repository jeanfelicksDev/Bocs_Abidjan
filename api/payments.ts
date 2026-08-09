import { sql } from './db';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const payments = await sql`
        SELECT 
          id, 
          facture_id as "factureId", 
          facture_numero as "factureNumero", 
          client_nom as "clientNom", 
          date_paiement as "datePaiement", 
          montant_paye as "montantPayeFcfa", 
          mode_paiement as "modePaiement", 
          reference, 
          caisse_nom as "caisseNom", 
          statut
        FROM payments 
        ORDER BY id DESC;
      `;

      const mapped = payments.map((p: any) => ({
        ...p,
        id: Number(p.id),
        factureId: Number(p.factureId),
        montantPayeFcfa: Number(p.montantPayeFcfa)
      }));

      return res.status(200).json({ success: true, payments: mapped });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const payment = req.body;
      if (!payment) {
        return res.status(400).json({ success: false, error: "Missing payment object." });
      }

      await sql`DELETE FROM payments WHERE id = ${payment.id};`;

      await sql`
        INSERT INTO payments (
          id, facture_id, facture_numero, client_nom, date_paiement, 
          montant_paye, mode_paiement, reference, caisse_nom, statut
        ) VALUES (
          ${payment.id}, ${payment.factureId}, ${payment.factureNumero}, ${payment.clientNom}, ${payment.datePaiement},
          ${payment.montantPayeFcfa}, ${payment.modePaiement}, ${payment.reference || ''}, ${payment.caisseNom}, ${payment.statut}
        );
      `;

      return res.status(200).json({ success: true, message: "Payment saved successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
