import { sql } from './db';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const escales = await sql`
        SELECT 
          id, 
          nom_navire as "nomNavire", 
          callsign, 
          numero_voyage as "numeroVoyage", 
          port_chargement as "portChargement", 
          port_dechargement as "portDechargement", 
          date_arrivee as "dateArrivee", 
          date_depart as "dateDepart", 
          statut, 
          created_by as "createdBy"
        FROM escales 
        ORDER BY id DESC;
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

      await sql`DELETE FROM escales WHERE id = ${escale.id};`;

      await sql`
        INSERT INTO escales (
          id, nom_navire, callsign, numero_voyage, port_chargement, port_dechargement,
          date_arrivee, date_depart, statut, created_by
        ) VALUES (
          ${escale.id}, ${escale.nomNavire}, ${escale.callsign}, ${escale.numeroVoyage},
          ${escale.portChargement}, ${escale.portDechargement}, ${escale.dateArrivee},
          ${escale.dateDepart || null}, ${escale.statut}, ${escale.createdBy || null}
        );
      `;

      return res.status(200).json({ success: true, message: "Escale saved successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const escaleId = req.query.id;
      if (!escaleId) {
        return res.status(400).json({ success: false, error: "Missing escale ID in query." });
      }

      // Cascade delete: containers -> bls -> escales -> invoice_items -> invoices
      await sql`
        DELETE FROM invoice_items 
        WHERE invoice_id IN (
          SELECT id FROM invoices 
          WHERE bl_id IN (
            SELECT id FROM bls 
            WHERE escale_id = ${escaleId}
          )
        );
      `;

      await sql`
        DELETE FROM invoices 
        WHERE bl_id IN (
          SELECT id FROM bls 
          WHERE escale_id = ${escaleId}
        );
      `;

      await sql`
        DELETE FROM containers 
        WHERE bl_id IN (
          SELECT id FROM bls 
          WHERE escale_id = ${escaleId}
        );
      `;

      await sql`
        DELETE FROM bls 
        WHERE escale_id = ${escaleId};
      `;

      await sql`
        DELETE FROM escales 
        WHERE id = ${escaleId};
      `;

      return res.status(200).json({ success: true, message: "Escale and associated data deleted successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
