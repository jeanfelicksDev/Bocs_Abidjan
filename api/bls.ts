import { sql } from './_db.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const bls = await sql`
        SELECT DISTINCT ON (numero_bl, escale_id)
          id, 
          escale_id as "escaleId", 
          numero_bl as "numeroBL", 
          type_operation as "typeOperation", 
          shipper_nom as "shipperNom", 
          shipper_adresse as "shipperAdresse", 
          consignee_nom as "consigneeNom", 
          consignee_adresse as "consigneeAdresse", 
          notify_nom as "notifyNom", 
          notify_adresse as "notifyAdresse", 
          port_chargement_code as "portChargementCode", 
          port_dechargement_code as "portDechargementCode", 
          destination_finale as "destinationFinale", 
          description_goods as "descriptionGoods", 
          nombre_colis as "nombreColis", 
          type_emballage as "typeEmballage", 
          poids_brut_kg as "poidsBrutKg", 
          volume_m3 as "volumeM3", 
          statut_import as "statutImport", 
          selected_invoice_type_ids as "selectedInvoiceTypeIds", 
          client_id as "clientId", 
          code_nature as "codeNature", 
          unique_carrier_ref as "uniqueCarrierRef", 
          marques_et_numeros as "marquesEtNumeros", 
          cachet_agent_appose as "cachetAgentAppose", 
          date_signature as "dateSignature", 
          hash_signature as "hashSignature"
        FROM bls 
        ORDER BY numero_bl, escale_id, id DESC;
      `;

      const containers = await sql`
        SELECT 
          id, 
          bl_id as "blId", 
          numero_conteneur as "numeroConteneur", 
          type_conteneur as "typeConteneur", 
          numero_scelle as "numeroScelle", 
          poids_kg as "poidsKg", 
          tare_kg as "tareKg", 
          nombre_colis as "nombreColis", 
          date_entree_parc as "dateEntreeParc", 
          date_sortie_parc as "dateSortieParc", 
          montant_caution_fcfa as "montantCautionFcfa", 
          statut_livraison as "statutLivraison",
          is_dangerous as "isDangerous",
          soc_coc as "socCoc"
        FROM containers;
      `;

      const mappedBls = bls.map((bl: any) => {
        const blIdNum = Number(bl.id);
        const selectedInvoiceTypeIds = bl.selectedInvoiceTypeIds 
          ? bl.selectedInvoiceTypeIds.split(',').filter(Boolean) 
          : [];
        return {
          ...bl,
          id: blIdNum,
          escaleId: Number(bl.escaleId),
          nombreColis: Number(bl.nombreColis),
          poidsBrutKg: Number(bl.poidsBrutKg),
          volumeM3: Number(bl.volumeM3),
          clientId: bl.clientId ? Number(bl.clientId) : undefined,
          cachetAgentAppose: Boolean(bl.cachetAgentAppose),
          selectedInvoiceTypeIds,
          conteneurs: containers
            .filter((c: any) => Number(c.blId) === blIdNum)
            .map((c: any) => ({
              ...c,
              id: Number(c.id),
              blId: Number(c.blId),
              poidsKg: Number(c.poidsKg),
              tareKg: Number(c.tareKg),
              nombreColis: Number(c.nombreColis),
              montantCautionFcfa: Number(c.montantCautionFcfa),
              isDangerous: Boolean(c.isDangerous),
              socCoc: c.socCoc || undefined
            }))
        };
      });

      return res.status(200).json({ success: true, bls: mappedBls });
    } catch (error: any) {
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

      // 1. Bulk Delete existing BLs and containers to avoid duplicates
      await sql`
        DELETE FROM containers 
        WHERE bl_id IN (
          SELECT id FROM bls 
          WHERE id = ANY(${blIds}::bigint[]) 
             OR numero_bl = ANY(${blNumbers.length > 0 ? blNumbers : ['']}::text[])
        );
      `;
      await sql`
        DELETE FROM bls 
        WHERE id = ANY(${blIds}::bigint[]) 
           OR numero_bl = ANY(${blNumbers.length > 0 ? blNumbers : ['']}::text[]);
      `;

      // 2. Prepare bulk insert arrays
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

      const containersToInsert: any[] = [];
      for (const bl of blsList) {
        if (bl.conteneurs && bl.conteneurs.length > 0) {
          for (const c of bl.conteneurs) {
            containersToInsert.push({
              id: c.id,
              bl_id: bl.id,
              numero_conteneur: c.numeroConteneur,
              type_conteneur: c.typeConteneur,
              numero_scelle: c.numeroScelle,
              poids_kg: c.poidsKg,
              tare_kg: c.tareKg,
              nombre_colis: c.nombreColis,
              date_entree_parc: c.dateEntreeParc || null,
              date_sortie_parc: c.dateSortieParc || null,
              montant_caution_fcfa: c.montantCautionFcfa,
              statut_livraison: c.statutLivraison || null,
              is_dangerous: c.isDangerous || false,
              soc_coc: c.socCoc || null
            });
          }
        }
      }

      // 3. Execute inserts
      for (const bl of blsToInsert) {
        await sql`
          INSERT INTO bls (
            id, escale_id, numero_bl, type_operation, shipper_nom, shipper_adresse,
            consignee_nom, consignee_adresse, notify_nom, notify_adresse,
            port_chargement_code, port_dechargement_code, destination_finale,
            description_goods, nombre_colis, type_emballage, poids_brut_kg,
            volume_m3, statut_import, selected_invoice_type_ids, client_id,
            code_nature, unique_carrier_ref, marques_et_numeros, cachet_agent_appose,
            date_signature, hash_signature
          ) VALUES (
            ${bl.id}, ${bl.escale_id}, ${bl.numero_bl}, ${bl.type_operation}, ${bl.shipper_nom}, ${bl.shipper_adresse},
            ${bl.consignee_nom}, ${bl.consignee_adresse}, ${bl.notify_nom}, ${bl.notify_adresse},
            ${bl.port_chargement_code}, ${bl.port_dechargement_code}, ${bl.destination_finale},
            ${bl.description_goods}, ${bl.nombre_colis}, ${bl.type_emballage}, ${bl.poids_brut_kg},
            ${bl.volume_m3}, ${bl.statut_import}, ${bl.selected_invoice_type_ids}, ${bl.client_id},
            ${bl.code_nature}, ${bl.unique_carrier_ref}, ${bl.marques_et_numeros}, ${bl.cachet_agent_appose},
            ${bl.date_signature}, ${bl.hash_signature}
          );
        `;
      }

      for (const c of containersToInsert) {
        await sql`
          INSERT INTO containers (
            id, bl_id, numero_conteneur, type_conteneur, numero_scelle,
            poids_kg, tare_kg, nombre_colis, date_entree_parc, date_sortie_parc,
            montant_caution_fcfa, statut_livraison, is_dangerous, soc_coc
          ) VALUES (
            ${c.id}, ${c.bl_id}, ${c.numero_conteneur}, ${c.type_conteneur}, ${c.numero_scelle},
            ${c.poids_kg}, ${c.tare_kg}, ${c.nombre_colis}, ${c.date_entree_parc}, ${c.date_sortie_parc},
            ${c.montant_caution_fcfa}, ${c.statut_livraison}, ${c.is_dangerous}, ${c.soc_coc}
          );
        `;
      }

      return res.status(200).json({ success: true, message: "BLs and containers saved successfully." });
    } catch (error: any) {
      console.error("Erreur bulk insert BLs:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const rawId = req.query.id || req.body?.id;
      const blId = Number(rawId);
      if (!rawId || isNaN(blId)) {
        return res.status(400).json({ success: false, error: "Missing or invalid BL ID." });
      }

      // 1. Fetch BL info
      const blResult = await sql`SELECT numero_bl FROM bls WHERE id = ${blId};`;
      const numeroBl = blResult.length > 0 ? blResult[0].numero_bl : '';

      // 2. Fetch linked invoices
      let invoiceIds: number[] = [];
      if (numeroBl) {
        const invoicesResult = await sql`
          SELECT id FROM invoices 
          WHERE bl_id = ${blId} OR numero_bl = ${numeroBl}
        `;
        invoiceIds = invoicesResult.map((i: any) => i.id);
      } else {
        const invoicesResult = await sql`
          SELECT id FROM invoices WHERE bl_id = ${blId}
        `;
        invoiceIds = invoicesResult.map((i: any) => i.id);
      }

      let creditNoteIds: number[] = [];
      if (invoiceIds.length > 0) {
        // 3. Fetch linked credit notes
        const cnResult = await sql`
          SELECT id FROM credit_notes 
          WHERE facture_id = ANY(${invoiceIds}::bigint[])
        `;
        creditNoteIds = cnResult.map((cn: any) => cn.id);

        // 4. Execute cascading delete for related records
        if (creditNoteIds.length > 0) {
          await sql`DELETE FROM credit_note_items WHERE credit_note_id = ANY(${creditNoteIds}::bigint[])`;
        }
        await sql`DELETE FROM credit_notes WHERE facture_id = ANY(${invoiceIds}::bigint[])`;
        await sql`DELETE FROM payments WHERE facture_id = ANY(${invoiceIds}::bigint[])`;
        await sql`DELETE FROM invoice_items WHERE invoice_id = ANY(${invoiceIds}::bigint[])`;
        await sql`DELETE FROM invoices WHERE id = ANY(${invoiceIds}::bigint[])`;
      }

      // 5. Delete containers and BL
      await sql`DELETE FROM containers WHERE bl_id = ${blId};`;
      await sql`DELETE FROM bls WHERE id = ${blId};`;

      return res.status(200).json({ success: true, message: "BL and associated containers, invoices deleted successfully." });
    } catch (error: any) {
      console.error("Erreur suppression BL:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
