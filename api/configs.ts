import { sql } from './_db.js';

export default async function handler(req: any, res: any) {
  // Safe Body Parsing
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  if (req.method === 'GET') {
    try {
      const types = await sql`
        SELECT 
          id, 
          name, 
          description 
        FROM invoice_type_configs 
        ORDER BY 
          CASE WHEN id ~ '^[0-9]+$' THEN id::bigint ELSE 9999999999 END, 
          id ASC;
      `;

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
        ORDER BY 
          invoice_type_id ASC, 
          CASE WHEN id ~ '^[0-9]+$' THEN id::bigint ELSE 9999999999 END, 
          id ASC;
      `;

      const mappedRubriques = rubriques.map((r: any) => ({
        ...r,
        id: String(r.id),
        invoiceTypeId: String(r.invoiceTypeId),
        isActive: Boolean(r.isActive),
        montantUnitaire: Number(r.montantUnitaire) || 0
      }));

      const mappedTypes = types.map((t: any) => ({
        ...t,
        id: String(t.id),
        name: String(t.name || ''),
        description: String(t.description || '')
      }));

      return res.status(200).json({ success: true, types: mappedTypes, rubriques: mappedRubriques });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { types, rubriques } = body;

      if (!types && !rubriques) {
        return res.status(400).json({ 
          success: false, 
          error: "Veuillez fournir 'types' et/ou 'rubriques' dans le corps de la requête." 
        });
      }

      // 1. Update Types if provided
      if (Array.isArray(types)) {
        await sql`DELETE FROM invoice_type_configs;`;
        for (const t of types) {
          if (!t.id || !t.name) continue;
          await sql`
            INSERT INTO invoice_type_configs (id, name, description)
            VALUES (${String(t.id)}, ${String(t.name).trim()}, ${String(t.description || '').trim()});
          `;
        }
      }

      // 2. Update Rubriques if provided
      if (Array.isArray(rubriques)) {
        await sql`DELETE FROM rubrique_configs;`;
        for (const r of rubriques) {
          if (!r.id || !r.invoiceTypeId || !r.name) continue;
          const isActive = r.isActive !== false;
          const montant = Math.round(Number(r.montantUnitaire)) || 0;
          const code = String(r.code || 'DIV').trim().toUpperCase();
          const category = String(r.category || 'CONTENEUR').toUpperCase();
          const baseCalcul = String(r.baseCalcul || 'BL');

          await sql`
            INSERT INTO rubrique_configs (
              id, 
              invoice_type_id, 
              category, 
              name, 
              description, 
              code, 
              is_active, 
              montant_unitaire, 
              base_calcul
            ) VALUES (
              ${String(r.id)}, 
              ${String(r.invoiceTypeId)}, 
              ${category}, 
              ${String(r.name).trim()}, 
              ${String(r.description || '').trim()}, 
              ${code}, 
              ${isActive}, 
              ${montant}, 
              ${baseCalcul}
            );
          `;
        }
      }

      return res.status(200).json({ 
        success: true, 
        message: "Configuration des types et rubriques enregistrée avec succès." 
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const typeId = req.query.typeId || body.typeId;
      const rubriqueId = req.query.rubriqueId || body.rubriqueId;

      if (typeId) {
        // Cascade delete rubriques first, then type
        await sql`DELETE FROM rubrique_configs WHERE invoice_type_id = ${String(typeId)};`;
        await sql`DELETE FROM invoice_type_configs WHERE id = ${String(typeId)};`;
        return res.status(200).json({ 
          success: true, 
          message: `Type de facture #${typeId} et ses rubriques associées ont été supprimés.` 
        });
      }

      if (rubriqueId) {
        await sql`DELETE FROM rubrique_configs WHERE id = ${String(rubriqueId)};`;
        return res.status(200).json({ 
          success: true, 
          message: `Rubrique #${rubriqueId} supprimée avec succès.` 
        });
      }

      return res.status(400).json({ 
        success: false, 
        error: "Paramètre 'typeId' ou 'rubriqueId' requis pour la suppression." 
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, error: "Méthode non autorisée." });
  }
}
