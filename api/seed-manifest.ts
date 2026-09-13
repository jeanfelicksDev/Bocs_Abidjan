import { sql } from './_db.js';
import { BOCS_BREMEN_25586_ESCALE, BOCS_BREMEN_25586_BLS_DATA } from '../src/utils/manifestParser.js';

export default async function handler(req: any, res: any) {
  try {
    const escaleId = BOCS_BREMEN_25586_ESCALE.id;

    // 1. Clean previous data for this escale
    const oldBls = await sql`SELECT id FROM bls WHERE escale_id = ${escaleId};`;
    for (const b of oldBls) {
      await sql`DELETE FROM containers WHERE bl_id = ${b.id};`;
    }
    await sql`DELETE FROM bls WHERE escale_id = ${escaleId};`;
    await sql`DELETE FROM escales WHERE id = ${escaleId};`;

    // 2. Insert Escale
    await sql`
      INSERT INTO escales (
        id, nom_navire, callsign, numero_voyage, port_chargement, port_dechargement, date_arrivee, date_depart, statut, created_by
      ) VALUES (
        ${escaleId},
        ${BOCS_BREMEN_25586_ESCALE.nomNavire},
        ${BOCS_BREMEN_25586_ESCALE.callsign},
        ${BOCS_BREMEN_25586_ESCALE.numeroVoyage},
        ${BOCS_BREMEN_25586_ESCALE.portChargement},
        ${BOCS_BREMEN_25586_ESCALE.portDechargement},
        ${BOCS_BREMEN_25586_ESCALE.dateArrivee},
        ${BOCS_BREMEN_25586_ESCALE.dateDepart || null},
        ${BOCS_BREMEN_25586_ESCALE.statut},
        ${BOCS_BREMEN_25586_ESCALE.createdBy || 'BOCS Import'}
      );
    `;

    // 3. Insert 18 BLs and Containers
    for (let idx = 0; idx < BOCS_BREMEN_25586_BLS_DATA.length; idx++) {
      const item = BOCS_BREMEN_25586_BLS_DATA[idx];
      const blId = escaleId * 1000 + idx + 1;

      await sql`
        INSERT INTO bls (
          id, escale_id, numero_bl, type_operation, shipper_nom, shipper_adresse,
          consignee_nom, consignee_adresse, notify_nom, notify_adresse,
          port_chargement_code, port_dechargement_code, destination_finale,
          description_goods, nombre_colis, type_emballage, poids_brut_kg,
          volume_m3, statut_import, marques_et_numeros
        ) VALUES (
          ${blId},
          ${escaleId},
          ${item.numeroBL},
          'IMPORT',
          ${item.shipperNom},
          ${item.shipperAdresse},
          ${item.consigneeNom},
          ${item.consigneeAdresse},
          ${item.notifyNom},
          ${item.notifyAdresse},
          ${item.portChargementCode},
          ${item.portDechargementCode},
          ${item.destinationFinale},
          ${item.descriptionGoods},
          ${item.nombreColis},
          ${item.typeEmballage},
          ${item.poidsBrutKg},
          ${item.volumeM3},
          'EN_ATTENTE',
          ${item.marquesEtNumeros}
        );
      `;

      if (item.conteneurs && item.conteneurs.length > 0) {
        for (let cIdx = 0; cIdx < item.conteneurs.length; cIdx++) {
          const c = item.conteneurs[cIdx];
          const containerId = escaleId * 10000 + idx * 100 + cIdx + 1;

          await sql`
            INSERT INTO containers (
              id, bl_id, numero_conteneur, type_conteneur, numero_scelle,
              poids_kg, tare_kg, nombre_colis, date_entree_parc,
              montant_caution_fcfa, statut_livraison, is_dangerous, soc_coc
            ) VALUES (
              ${containerId},
              ${blId},
              ${c.numeroConteneur},
              ${c.typeConteneur},
              ${c.numeroScelle},
              ${c.poidsKg},
              ${c.tareKg},
              ${c.nombreColis},
              ${c.dateEntreeParc || '2025-07-16T08:00:00Z'},
              ${c.montantCautionFcfa},
              ${c.statutLivraison || 'AU_PARC'},
              ${c.isDangerous || false},
              ${c.socCoc || 'COC'}
            );
          `;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Escale BOCS BREMEN (Voyage 25586) et ses ${BOCS_BREMEN_25586_BLS_DATA.length} Connaissements (BLs) ont été synchronisés avec succès dans la base de données.`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
