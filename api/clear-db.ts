import { sql } from './_db.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // mode=purge  → suppression totale (toutes les données)
  // mode=cleanup → nettoyage ciblé (orphelins + données vides uniquement) [défaut]
  const mode = req.query?.mode || req.body?.mode || 'cleanup';

  try {
    if (mode === 'purge') {
      // ── PURGE TOTALE ──────────────────────────────────────────────────────
      await sql`DELETE FROM payments;`;
      await sql`DELETE FROM credit_note_items;`;
      await sql`DELETE FROM credit_notes;`;
      await sql`DELETE FROM invoice_items;`;
      await sql`DELETE FROM invoices;`;
      await sql`DELETE FROM containers;`;
      await sql`DELETE FROM bls;`;
      await sql`DELETE FROM escales;`;
      await sql`DELETE FROM audit_logs;`;
      return res.status(200).json({ success: true, message: "Purge totale effectuée avec succès." });
    }

    // ── NETTOYAGE CIBLÉ DES ORPHELINS ET DES VIDES (mode=cleanup) ──────────
    const report: Record<string, number> = {};

    const executeSafe = async (key: string, queryFn: () => Promise<any>) => {
      try {
        const result = await queryFn();
        report[key] = Array.isArray(result) ? result.length : (typeof result?.count === 'number' ? result.count : 0);
      } catch (err: any) {
        console.error(`Error during cleanup step [${key}]:`, err);
        report[key + '_error'] = err.message || 1;
      }
    };

    // 1. Lignes de factures orphelines (sans facture parente existante)
    await executeSafe('invoice_items_orphelins', () => sql`
      DELETE FROM invoice_items
      WHERE invoice_id NOT IN (SELECT id FROM invoices)
      RETURNING id;
    `);

    // 2. Paiements orphelins (sans facture parente existante)
    await executeSafe('paiements_orphelins', () => sql`
      DELETE FROM payments
      WHERE facture_id NOT IN (SELECT id FROM invoices)
      RETURNING id;
    `);

    // 3. Lignes d'avoir orphelines
    await executeSafe('credit_note_items_orphelins', () => sql`
      DELETE FROM credit_note_items
      WHERE credit_note_id NOT IN (SELECT id FROM credit_notes)
      RETURNING id;
    `);

    // 4. Notes d'avoir orphelines (sans facture parente)
    await executeSafe('avoirs_orphelins', () => sql`
      DELETE FROM credit_notes
      WHERE facture_id NOT IN (SELECT id FROM invoices)
      RETURNING id;
    `);

    // 5. Conteneurs orphelins (sans BL parent)
    await executeSafe('conteneurs_orphelins', () => sql`
      DELETE FROM containers
      WHERE bl_id NOT IN (SELECT id FROM bls)
      RETURNING id;
    `);

    // 6. Factures avec numéro vide ou NULL
    await executeSafe('factures_sans_numero', () => sql`
      DELETE FROM invoices
      WHERE numero_facture IS NULL OR TRIM(numero_facture) = ''
      RETURNING id;
    `);

    // 7. Factures fantômes (montants nuls ET client/bl vide ET non payées)
    await executeSafe('factures_fantomes_vides', () => sql`
      DELETE FROM invoices
      WHERE (montant_ttc = 0 OR montant_ttc IS NULL)
        AND (montant_ht = 0 OR montant_ht IS NULL)
        AND (client_nom IS NULL OR TRIM(client_nom) = '')
        AND (numero_bl IS NULL OR TRIM(numero_bl) = '')
        AND (statut_paiement = 'NON_PAYE' OR statut_paiement IS NULL)
      RETURNING id;
    `);

    // 8. BLs avec numéro de BL vide ou NULL
    await executeSafe('bls_sans_numero', () => sql`
      DELETE FROM bls
      WHERE numero_bl IS NULL OR TRIM(numero_bl) = ''
      RETURNING id;
    `);

    // 9. Conteneurs avec numéro de conteneur vide ou NULL
    await executeSafe('conteneurs_sans_numero', () => sql`
      DELETE FROM containers
      WHERE numero_conteneur IS NULL OR TRIM(numero_conteneur) = ''
      RETURNING id;
    `);

    // 10. Escales fantômes sans nom ni voyage
    await executeSafe('escales_vides', () => sql`
      DELETE FROM escales
      WHERE (nom_navire IS NULL OR TRIM(nom_navire) = '')
        AND (numero_voyage IS NULL OR TRIM(numero_voyage) = '')
      RETURNING id;
    `);

    // 11. Lignes d'articles de facture vides (quantité 0 ET montant 0 hors DMDT)
    await executeSafe('lignes_facture_vides', () => sql`
      DELETE FROM invoice_items
      WHERE quantite = 0
        AND montant_ht = 0
        AND (designation IS NULL OR TRIM(designation) = '' OR type_frais != 'DMDT_SURESTARIE')
      RETURNING id;
    `);

    // 12. Doublons de factures (conserver la plus ancienne / MIN(id))
    await executeSafe('doublons_factures', () => sql`
      DELETE FROM invoices
      WHERE id NOT IN (
        SELECT MIN(id) FROM invoices GROUP BY numero_facture
      )
      RETURNING id;
    `);

    // 13. Nettoyage après suppression des factures (lignes et paiements devenus orphelins)
    await executeSafe('nettoyage_cascade_lignes', () => sql`
      DELETE FROM invoice_items
      WHERE invoice_id NOT IN (SELECT id FROM invoices)
      RETURNING id;
    `);

    const totalCleaned = Object.entries(report)
      .filter(([k]) => !k.endsWith('_error'))
      .reduce((sum, [, v]) => sum + (typeof v === 'number' ? v : 0), 0);

    return res.status(200).json({
      success: true,
      message: `Nettoyage des données orphelines et vides terminé. ${totalCleaned} enregistrement(s) nettoyé(s).`,
      details: report
    });

  } catch (error: any) {
    console.error('DB cleanup general error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

