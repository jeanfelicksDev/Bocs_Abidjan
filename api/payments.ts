import { prisma } from './_db.js';

const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
));

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const payments = await prisma.payments.findMany({
        orderBy: { id: 'desc' }
      });

      const mapped = payments.map((p: any) => ({
        id: Number(p.id),
        factureId: Number(p.facture_id),
        numeroFacture: p.facture_numero || '',
        factureNumero: p.facture_numero || '',
        clientNom: p.client_nom || '',
        datePaiement: p.date_paiement || '',
        modePaiement: p.mode_paiement || 'VIREMENT',
        montantFcfa: Number(p.montant_paye || 0),
        montantPayeFcfa: Number(p.montant_paye || 0),
        referenceTransaction: p.reference || '',
        reference: p.reference || '',
        saisiPar: p.caisse_nom || '',
        caisseNom: p.caisse_nom || '',
        statut: p.statut || 'VALIDE',
        deletedAt: p.deleted_at?.toISOString()
      }));

      return res.status(200).json({ success: true, payments: serialize(mapped) });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const payment = req.body;
      if (!payment) {
        return res.status(400).json({ success: false, error: "Missing payment object." });
      }

      await prisma.payments.deleteMany({ where: { id: payment.id } });

      await prisma.payments.create({
        data: {
          id: payment.id,
          facture_id: payment.factureId,
          facture_numero: payment.numeroFacture || payment.factureNumero || '',
          client_nom: payment.clientNom || 'Client',
          date_paiement: payment.datePaiement,
          montant_paye: payment.montantFcfa || payment.montantPayeFcfa || 0,
          mode_paiement: payment.modePaiement,
          reference: payment.referenceTransaction || payment.reference || '',
          caisse_nom: payment.saisiPar || payment.caisseNom || 'Service Comptabilité BOCS',
          statut: payment.statut || 'VALIDE'
        }
      });

      return res.status(200).json({ success: true, message: "Payment saved successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
