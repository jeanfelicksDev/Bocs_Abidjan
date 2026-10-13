import { prisma } from './_db.js';

// Helper pour gérer le BigInt
const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
));

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const bls = await prisma.bls.findMany({
        where: { deleted_at: null },
        orderBy: [
          { numero_bl: 'asc' },
          { escale_id: 'asc' },
          { id: 'desc' }
        ]
      });

      const containers = await prisma.containers.findMany({
        where: { deleted_at: null }
      });

      const mappedBls = bls.map((bl: any) => {
        const blIdNum = Number(bl.id);
        const selectedInvoiceTypeIds = bl.selected_invoice_type_ids 
          ? bl.selected_invoice_type_ids.split(',').filter(Boolean) 
          : [];
        return {
          ...bl,
          id: blIdNum,
          escaleId: Number(bl.escale_id),
          numeroBL: bl.numero_bl,
          typeOperation: bl.type_operation,
          shipperNom: bl.shipper_nom,
          shipperAdresse: bl.shipper_adresse,
          consigneeNom: bl.consignee_nom,
          consigneeAdresse: bl.consignee_adresse,
          notifyNom: bl.notify_nom,
          notifyAdresse: bl.notify_adresse,
          portChargementCode: bl.port_chargement_code,
          portDechargementCode: bl.port_dechargement_code,
          destinationFinale: bl.destination_finale,
          descriptionGoods: bl.description_goods,
          nombreColis: Number(bl.nombre_colis),
          typeEmballage: bl.type_emballage,
          poidsBrutKg: Number(bl.poids_brut_kg),
          volumeM3: Number(bl.volume_m3),
          statutImport: bl.statut_import,
          clientId: bl.client_id ? Number(bl.client_id) : undefined,
          codeNature: bl.code_nature,
          uniqueCarrierRef: bl.unique_carrier_ref,
          marquesEtNumeros: bl.marques_et_numeros,
          cachetAgentAppose: Boolean(bl.cachet_agent_appose),
          dateSignature: bl.date_signature,
          hashSignature: bl.hash_signature,
          selectedInvoiceTypeIds,
          conteneurs: containers
            .filter((c: any) => Number(c.bl_id) === blIdNum)
            .map((c: any) => ({
              ...c,
              id: Number(c.id),
              blId: Number(c.bl_id),
              numeroConteneur: c.numero_conteneur,
              typeConteneur: c.type_conteneur,
              numeroScelle: c.numero_scelle,
              poidsKg: Number(c.poids_kg),
              tareKg: Number(c.tare_kg),
              nombreColis: Number(c.nombre_colis),
              dateEntreeParc: c.date_entree_parc,
              dateSortieParc: c.date_sortie_parc,
              montantCautionFcfa: Number(c.montant_caution_fcfa),
              statutLivraison: c.statut_livraison,
              isDangerous: Boolean(c.is_dangerous),
              socCoc: c.soc_coc || undefined,
              dmdtWaiverStatus: c.dmdt_waiver_status || undefined,
              dmdtWaiverDays: c.dmdt_waiver_days ? Number(c.dmdt_waiver_days) : undefined,
              dmdtWaiverReason: c.dmdt_waiver_reason || undefined,
              dmdtWaiverApproverId: c.dmdt_waiver_approver_id ? Number(c.dmdt_waiver_approver_id) : undefined,
              deletedAt: c.deleted_at?.toISOString()
            })),
          deletedAt: bl.deleted_at?.toISOString()
        };
      });

      return res.status(200).json({ success: true, bls: serialize(mappedBls) });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const data = req.body;
      const blsList = Array.isArray(data.bls) ? data.bls : (data.id ? [data] : []);

      if (blsList.length === 0) {
        return res.status(400).json({ success: false, error: "No BLs provided." });
      }

      const blIds = blsList.map((bl: any) => bl.id);
      const blNumbers = blsList.map((bl: any) => bl.numeroBL).filter(Boolean);

      // We cannot bulk insert easily in Prisma with different structures, but createMany is possible
      // Let's create one by one or createMany:
      const blsToInsert = blsList.map((bl: any) => ({
        id: bl.id,
        escale_id: bl.escaleId,
        numero_bl: bl.numeroBL,
        type_operation: bl.typeOperation,
        shipper_nom: bl.shipperNom,
        shipper_adresse: bl.shipperAdresse || '',
        consignee_nom: bl.consigneeNom,
        consignee_adresse: bl.consigneeAdresse || '',
        notify_nom: bl.notifyNom || '',
        notify_adresse: bl.notifyAdresse || '',
        port_chargement_code: bl.portChargementCode,
        port_dechargement_code: bl.portDechargementCode,
        destination_finale: bl.destinationFinale || '',
        description_goods: bl.descriptionGoods || '',
        nombre_colis: bl.nombreColis,
        type_emballage: bl.typeEmballage,
        poids_brut_kg: bl.poidsBrutKg,
        volume_m3: bl.volumeM3,
        statut_import: bl.statutImport || 'EN_ATTENTE',
        selected_invoice_type_ids: Array.isArray(bl.selectedInvoiceTypeIds) ? bl.selectedInvoiceTypeIds.join(',') : '',
        client_id: bl.clientId || null,
        code_nature: bl.codeNature || '',
        unique_carrier_ref: bl.uniqueCarrierRef || '',
        marques_et_numeros: bl.marquesEtNumeros || '',
        cachet_agent_appose: bl.cachetAgentAppose || false,
        date_signature: bl.dateSignature || null,
        hash_signature: bl.hashSignature || null
      }));

      // Containers
      const containersToInsert: any[] = [];
      blsList.forEach((bl: any) => {
        if (bl.conteneurs && Array.isArray(bl.conteneurs)) {
          bl.conteneurs.forEach((c: any) => {
            containersToInsert.push({
              id: c.id,
              bl_id: c.blId || bl.id,
              numero_conteneur: c.numeroConteneur,
              type_conteneur: c.typeConteneur,
              numero_scelle: c.numeroScelle,
              poids_kg: c.poidsKg,
              tare_kg: c.tareKg,
              nombre_colis: c.nombreColis,
              date_entree_parc: c.dateEntreeParc || null,
              date_sortie_parc: c.dateSortieParc || null,
              montant_caution_fcfa: c.montantCautionFcfa || 0,
              statut_livraison: c.statutLivraison || null,
              is_dangerous: c.isDangerous || false,
              soc_coc: c.socCoc || null
            });
          });
        }
      });

      // A rejected replacement must not erase the current manifest.
      await prisma.$transaction(async (tx) => {
        const existingBls = await tx.bls.findMany({
          where: { OR: [{ id: { in: blIds } }, { numero_bl: { in: blNumbers } }] },
          select: { id: true }
        });
        const existingBlIds = existingBls.map(bl => bl.id);

        if (existingBlIds.length > 0) {
          await tx.containers.deleteMany({ where: { bl_id: { in: existingBlIds } } });
          await tx.bls.deleteMany({ where: { id: { in: existingBlIds } } });
        }

        await tx.bls.createMany({ data: blsToInsert });
        if (containersToInsert.length > 0) {
          await tx.containers.createMany({ data: containersToInsert });
        }
      });

      return res.status(200).json({ success: true, message: `${blsList.length} BL(s) saved successfully.` });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const rawId = req.query.id || req.body?.id;
      const blId = Number(rawId);
      
      if (!rawId || isNaN(blId)) {
        return res.status(400).json({ success: false, error: "Missing or invalid BL ID." });
      }

      // 1. Find the BL to get the BL number
      const blResult = await prisma.bls.findUnique({
        where: { id: blId },
        select: { numero_bl: true }
      });

      if (!blResult) {
        return res.status(404).json({ success: false, error: "BL not found." });
      }

      const blNumber = blResult.numero_bl;

      // 2. Find all invoices for this BL
      const invoicesResult = await prisma.invoices.findMany({
        where: {
          OR: [ { bl_id: blId }, { numero_bl: blNumber } ]
        },
        select: { id: true }
      });
      const invoiceIds = invoicesResult.map((i: any) => i.id);

      // 3. Find credit notes
      let creditNoteIds: bigint[] = [];
      if (invoiceIds.length > 0) {
        const creditNotesResult = await prisma.credit_notes.findMany({
          where: { facture_id: { in: invoiceIds } },
          select: { id: true }
        });
        creditNoteIds = creditNotesResult.map((c: any) => c.id);
      }

      // 4. Delete dependent data
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

      await prisma.containers.deleteMany({ where: { bl_id: blId } });
      await prisma.bls.deleteMany({ where: { id: blId } });

      return res.status(200).json({ success: true, message: `BL ${blId} et dépendances supprimés.` });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }
}
