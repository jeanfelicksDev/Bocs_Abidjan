import { prisma } from './_db.js';

// Helper pour gérer le BigInt
const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
));

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const escales = await prisma.escales.findMany({
        where: { deleted_at: null },
        orderBy: [
          { nom_navire: 'asc' },
          { numero_voyage: 'asc' },
          { id: 'desc' }
        ]
      });
      
      const mappedEscales = escales.map((e: any) => ({
        ...e,
        id: Number(e.id),
        nomNavire: e.nom_navire,
        numeroVoyage: e.numero_voyage,
        portChargement: e.port_chargement,
        portDechargement: e.port_dechargement,
        dateArrivee: e.date_arrivee,
        dateAccostage: e.date_accostage,
        dateDepart: e.date_depart,
        quai: e.quai,
        createdBy: e.created_by,
        vesselId: e.vessel_id ? Number(e.vessel_id) : undefined,
        statusGeofencing: e.status_geofencing,
        deletedAt: e.deleted_at?.toISOString()
      }));
      return res.status(200).json({ success: true, escales: serialize(mappedEscales) });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const escale = req.body;
      if (!escale || !escale.id) {
        return res.status(400).json({ success: false, error: "Missing escale data." });
      }

      const data = {
        nom_navire: escale.nomNavire,
        callsign: escale.callsign,
        numero_voyage: escale.numeroVoyage,
        port_chargement: escale.portChargement,
        port_dechargement: escale.portDechargement,
        date_arrivee: escale.dateArrivee,
        date_accostage: escale.dateAccostage || null,
        date_depart: escale.dateDepart || null,
        quai: escale.quai || null,
        statut: escale.statut,
        created_by: escale.createdBy || null
      };

      // A failed write must never erase an existing escale. For a re-import of
      // the same vessel/voyage, retain its primary key and its linked BLs.
      const saved = await prisma.$transaction(async (tx) => {
        const existing = await tx.escales.findFirst({
          where: {
            OR: [
              { id: escale.id },
              { nom_navire: escale.nomNavire, numero_voyage: escale.numeroVoyage }
            ]
          },
          select: { id: true }
        });

        if (existing) {
          return tx.escales.update({ where: { id: existing.id }, data });
        } else {
          return tx.escales.create({ data: { id: escale.id, ...data } });
        }
      });

      return res.status(200).json({
        success: true,
        message: "Escale saved successfully.",
        escale: serialize({
          ...saved,
          id: Number(saved.id),
          nomNavire: saved.nom_navire,
          numeroVoyage: saved.numero_voyage,
          portChargement: saved.port_chargement,
          portDechargement: saved.port_dechargement,
          dateArrivee: saved.date_arrivee,
          dateAccostage: saved.date_accostage,
          dateDepart: saved.date_depart,
          quai: saved.quai,
          createdBy: saved.created_by
        })
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const rawId = req.query.id || req.body?.id;
      
      if (rawId === 'ALL') {
        await prisma.payments.deleteMany();
        await prisma.credit_note_items.deleteMany();
        await prisma.credit_notes.deleteMany();
        await prisma.invoice_items.deleteMany();
        await prisma.invoices.deleteMany();
        await prisma.containers.deleteMany();
        await prisma.bls.deleteMany();
        await prisma.escales.deleteMany();
        return res.status(200).json({ success: true, message: "Toutes les escales et données associées ont été supprimées." });
      }

      const escaleId = Number(rawId);
      if (!rawId || isNaN(escaleId)) {
        return res.status(400).json({ success: false, error: "Missing or invalid escale ID." });
      }

      const blsResult = await prisma.bls.findMany({
        where: { escale_id: escaleId },
        select: { id: true, numero_bl: true }
      });
      const blIds = blsResult.map(b => b.id);
      const blNumbers = blsResult.map(b => b.numero_bl).filter(Boolean);

      let invoiceIds: bigint[] = [];
      if (blIds.length > 0 || blNumbers.length > 0) {
        const invoicesResult = await prisma.invoices.findMany({
          where: {
            OR: [
              { bl_id: { in: blIds } },
              { numero_bl: { in: blNumbers } }
            ]
          },
          select: { id: true }
        });
        invoiceIds = invoicesResult.map(i => i.id);
      }

      let creditNoteIds: bigint[] = [];
      if (invoiceIds.length > 0) {
        const creditNotesResult = await prisma.credit_notes.findMany({
          where: { facture_id: { in: invoiceIds } },
          select: { id: true }
        });
        creditNoteIds = creditNotesResult.map(c => c.id);
      }

      // Deletions in order of dependencies
      if (invoiceIds.length > 0) {
        await prisma.payments.deleteMany({ where: { facture_id: { in: invoiceIds.map(id => Number(id)) } } });
      }
      
      if (creditNoteIds.length > 0) {
        await prisma.credit_note_items.deleteMany({ where: { credit_note_id: { in: creditNoteIds } } });
        await prisma.credit_notes.deleteMany({ where: { id: { in: creditNoteIds } } });
      }

      if (invoiceIds.length > 0) {
        await prisma.invoice_items.deleteMany({ where: { invoice_id: { in: invoiceIds } } });
        await prisma.invoices.deleteMany({ where: { id: { in: invoiceIds } } });
      }

      if (blIds.length > 0) {
        await prisma.containers.deleteMany({ where: { bl_id: { in: blIds } } });
        await prisma.bls.deleteMany({ where: { id: { in: blIds } } });
      }

      await prisma.escales.deleteMany({ where: { id: escaleId } });

      return res.status(200).json({ success: true, message: `Escale ${escaleId} et ses dépendances supprimées.` });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }
}
