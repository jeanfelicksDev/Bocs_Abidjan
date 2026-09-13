import { sql } from './_db.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const escales = await sql`
        SELECT DISTINCT ON (nom_navire, numero_voyage)
          id, 
          nom_navire as "nomNavire", 
          callsign, 
          numero_voyage as "numeroVoyage", 
          port_chargement as "portChargement", 
          port_dechargement as "portDechargement", 
          date_arrivee as "dateArrivee", 
          date_accostage as "dateAccostage",
          date_depart as "dateDepart", 
          quai,
          statut, 
          created_by as "createdBy"
        FROM escales 
        ORDER BY nom_navire, numero_voyage, id DESC;
      `;
      const mappedEscales = escales.map((e: any) => ({
        ...e,
        id: Number(e.id)
      }));
      return res.status(200).json({ success: true, escales: mappedEscales });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const escale = req.body;
      if (!escale || !escale.id) {
        return res.status(400).json({ success: false, error: "Missing escale data." });
      }

      await sql`
        DELETE FROM escales 
        WHERE id = ${escale.id} 
           OR (nom_navire = ${escale.nomNavire} AND numero_voyage = ${escale.numeroVoyage});
      `;

      await sql`
        INSERT INTO escales (
          id, nom_navire, callsign, numero_voyage, port_chargement, port_dechargement,
          date_arrivee, date_accostage, date_depart, quai, statut, created_by
        ) VALUES (
          ${escale.id}, ${escale.nomNavire}, ${escale.callsign}, ${escale.numeroVoyage},
          ${escale.portChargement}, ${escale.portDechargement}, ${escale.dateArrivee},
          ${escale.dateAccostage || null}, ${escale.dateDepart || null}, ${escale.quai || null}, 
          ${escale.statut}, ${escale.createdBy || null}
        );
      `;

      return res.status(200).json({ success: true, message: "Escale saved successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const rawId = req.query.id || req.body?.id;
      
      if (rawId === 'ALL') {
        await sql`DELETE FROM payments;`;
        await sql`DELETE FROM credit_note_items;`;
        await sql`DELETE FROM credit_notes;`;
        await sql`DELETE FROM invoice_items;`;
        await sql`DELETE FROM invoices;`;
        await sql`DELETE FROM containers;`;
        await sql`DELETE FROM bls;`;
        await sql`DELETE FROM escales;`;
        return res.status(200).json({ success: true, message: "Toutes les escales et données associées ont été supprimées." });
      }

      const escaleId = Number(rawId);
      if (!rawId || isNaN(escaleId)) {
        return res.status(400).json({ success: false, error: "Missing or invalid escale ID." });
      }

      // 1. Find all BLs for this escale
      const blsResult = await sql`SELECT id, numero_bl FROM bls WHERE escale_id = ${escaleId};`;
      const blIds = blsResult.map((b: any) => b.id);
      const blNumbers = blsResult.map((b: any) => b.numero_bl).filter(Boolean);

      let invoiceIds: number[] = [];

      if (blIds.length > 0 || blNumbers.length > 0) {
        // 2. Find all invoices for these BLs
        // We use two queries to avoid full table scan OR conditions if possible, or just a simple query
        const invoicesResult = await sql`
          SELECT id FROM invoices 
          WHERE (bl_id = ANY(${blIds.length > 0 ? blIds : [0]}::bigint[]))
             OR (numero_bl = ANY(${blNumbers.length > 0 ? blNumbers : ['']}::text[]))
        `;
        invoiceIds = invoicesResult.map((i: any) => i.id);
      }

      let creditNoteIds: number[] = [];

      if (invoiceIds.length > 0) {
        // 3. Find all credit notes for these invoices
        const creditNotesResult = await sql`
          SELECT id FROM credit_notes 
          WHERE facture_id = ANY(${invoiceIds}::bigint[])
        `;
        creditNoteIds = creditNotesResult.map((cn: any) => cn.id);

        // 4. Cascade Delete
        if (creditNoteIds.length > 0) {
          await sql`DELETE FROM credit_note_items WHERE credit_note_id = ANY(${creditNoteIds}::bigint[])`;
        }
        await sql`DELETE FROM credit_notes WHERE facture_id = ANY(${invoiceIds}::bigint[])`;
        await sql`DELETE FROM payments WHERE facture_id = ANY(${invoiceIds}::bigint[])`;
        await sql`DELETE FROM invoice_items WHERE invoice_id = ANY(${invoiceIds}::bigint[])`;
        await sql`DELETE FROM invoices WHERE id = ANY(${invoiceIds}::bigint[])`;
      }

      if (blIds.length > 0) {
        await sql`DELETE FROM containers WHERE bl_id = ANY(${blIds}::bigint[])`;
      }

      await sql`DELETE FROM bls WHERE escale_id = ${escaleId};`;
      await sql`DELETE FROM escales WHERE id = ${escaleId};`;

      // Clean any potential orphan records
      await sql`DELETE FROM containers WHERE bl_id NOT IN (SELECT id FROM bls);`;
      await sql`DELETE FROM bls WHERE escale_id NOT IN (SELECT id FROM escales);`;

      return res.status(200).json({ success: true, message: "Escale and associated data deleted successfully." });
    } catch (error: any) {
      console.error("Erreur suppression escale:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
