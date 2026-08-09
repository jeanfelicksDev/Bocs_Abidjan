import { sql } from './db';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const bls = await sql`
        SELECT 
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
        ORDER BY id DESC;
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
          statut_livraison as "statutLivraison"
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
              montantCautionFcfa: Number(c.montantCautionFcfa)
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

      for (const bl of blsList) {
        // Clear existing
        await sql`DELETE FROM containers WHERE bl_id = ${bl.id};`;
        await sql`DELETE FROM bls WHERE id = ${bl.id};`;

        const selectedInvoiceTypeIdsStr = Array.isArray(bl.selectedInvoiceTypeIds) 
          ? bl.selectedInvoiceTypeIds.join(',') 
          : '';

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
            ${bl.id}, ${bl.escaleId}, ${bl.numeroBL}, ${bl.typeOperation}, ${bl.shipperNom}, ${bl.shipperAdresse || ''},
            ${bl.consigneeNom}, ${bl.consigneeAdresse || ''}, ${bl.notifyNom || ''}, ${bl.notifyAdresse || ''},
            ${bl.portChargementCode}, ${bl.portDechargementCode}, ${bl.destinationFinale || ''},
            ${bl.descriptionGoods || ''}, ${bl.nombreColis}, ${bl.typeEmballage}, ${bl.poidsBrutKg},
            ${bl.volumeM3}, ${bl.statutImport || 'EN_ATTENTE'}, ${selectedInvoiceTypeIdsStr}, ${bl.clientId || null},
            ${bl.codeNature || ''}, ${bl.uniqueCarrierRef || ''}, ${bl.marquesEtNumeros || ''}, ${bl.cachetAgentAppose || false},
            ${bl.dateSignature || null}, ${bl.hashSignature || null}
          );
        `;

        if (bl.conteneurs && bl.conteneurs.length > 0) {
          for (const c of bl.conteneurs) {
            await sql`
              INSERT INTO containers (
                id, bl_id, numero_conteneur, type_conteneur, numero_scelle,
                poids_kg, tare_kg, nombre_colis, date_entree_parc, date_sortie_parc,
                montant_caution_fcfa, statut_livraison
              ) VALUES (
                ${c.id}, ${bl.id}, ${c.numeroConteneur}, ${c.typeConteneur}, ${c.numeroScelle},
                ${c.poidsKg}, ${c.tareKg}, ${c.nombreColis}, ${c.dateEntreeParc || null}, ${c.dateSortieParc || null},
                ${c.montantCautionFcfa}, ${c.statutLivraison || null}
              );
            `;
          }
        }
      }

      return res.status(200).json({ success: true, message: "BLs and containers saved successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
