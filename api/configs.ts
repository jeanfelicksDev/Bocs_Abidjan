import { sql } from './db';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const types = await sql`SELECT id, name, description FROM invoice_type_configs ORDER BY id;`;
      const rubriques = await sql`
        SELECT 
          id, 
          invoice_type_id as "invoiceTypeId", 
          category, 
          name, 
          description, 
          code, 
          is_active as "isActive", 
          montant_unitaire as "montantUnitaire", 
          base_calcul as "baseCalcul" 
        FROM rubrique_configs 
        ORDER BY id;
      `;
      return res.status(200).json({ success: true, types, rubriques });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { types, rubriques } = req.body;

      if (!types || !rubriques) {
        return res.status(400).json({ success: false, error: "Missing types or rubriques in request body." });
      }

      // Clear and rebuild configurations
      await sql`DELETE FROM rubrique_configs;`;
      await sql`DELETE FROM invoice_type_configs;`;

      for (const t of types) {
        await sql`
          INSERT INTO invoice_type_configs (id, name, description)
          VALUES (${t.id}, ${t.name}, ${t.description || ''});
        `;
      }

      for (const r of rubriques) {
        await sql`
          INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul)
          VALUES (${r.id}, ${r.invoiceTypeId}, ${r.category}, ${r.name}, ${r.description || ''}, ${r.code}, ${r.isActive}, ${r.montantUnitaire}, ${r.baseCalcul});
        `;
      }

      return res.status(200).json({ success: true, message: "Configurations saved successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
