import { prisma } from './_db.js';

export default async function handler(req: any, res: any) {
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
      const types = await prisma.invoice_type_configs.findMany();
      // Sorting purely in JS since alphanumeric ID sorting in Postgres is complex with Prisma
      types.sort((a: any, b: any) => {
        const aNum = /^\d+$/.test(a.id) ? Number(a.id) : 9999999999;
        const bNum = /^\d+$/.test(b.id) ? Number(b.id) : 9999999999;
        if (aNum !== bNum) return aNum - bNum;
        return a.id.localeCompare(b.id);
      });

      const rubriques = await prisma.rubrique_configs.findMany();
      rubriques.sort((a: any, b: any) => {
        if (a.invoice_type_id !== b.invoice_type_id) {
          return String(a.invoice_type_id).localeCompare(String(b.invoice_type_id));
        }
        const aNum = /^\d+$/.test(a.id) ? Number(a.id) : 9999999999;
        const bNum = /^\d+$/.test(b.id) ? Number(b.id) : 9999999999;
        if (aNum !== bNum) return aNum - bNum;
        return a.id.localeCompare(b.id);
      });

      const mappedRubriques = rubriques.map((r: any) => ({
        ...r,
        id: String(r.id),
        invoiceTypeId: String(r.invoice_type_id),
        isActive: Boolean(r.is_active),
        montantUnitaire: Number(r.montant_unitaire) || 0,
        baseCalcul: String(r.base_calcul)
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

      if (Array.isArray(types)) {
        await prisma.invoice_type_configs.deleteMany();
        if (types.length > 0) {
          const typesToInsert = types.filter(t => t.id && t.name).map(t => ({
            id: String(t.id),
            name: String(t.name).trim(),
            description: String(t.description || '').trim()
          }));
          await prisma.invoice_type_configs.createMany({ data: typesToInsert });
        }
      }

      if (Array.isArray(rubriques)) {
        await prisma.rubrique_configs.deleteMany();
        if (rubriques.length > 0) {
          const rubriquesToInsert = rubriques.filter(r => r.id && r.invoiceTypeId && r.name).map(r => ({
            id: String(r.id),
            invoice_type_id: String(r.invoiceTypeId),
            category: String(r.category || 'CONTENEUR').toUpperCase(),
            name: String(r.name).trim(),
            description: String(r.description || '').trim(),
            code: String(r.code || 'DIV').trim().toUpperCase(),
            is_active: r.isActive !== false,
            montant_unitaire: Math.round(Number(r.montantUnitaire)) || 0,
            base_calcul: String(r.baseCalcul || 'BL')
          }));
          await prisma.rubrique_configs.createMany({ data: rubriquesToInsert });
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
        await prisma.rubrique_configs.deleteMany({ where: { invoice_type_id: String(typeId) } });
        await prisma.invoice_type_configs.deleteMany({ where: { id: String(typeId) } });
        return res.status(200).json({ 
          success: true, 
          message: `Type de facture #${typeId} et ses rubriques associées ont été supprimés.` 
        });
      }

      if (rubriqueId) {
        await prisma.rubrique_configs.deleteMany({ where: { id: String(rubriqueId) } });
        return res.status(200).json({ 
          success: true, 
          message: `Rubrique de tarification #${rubriqueId} supprimée avec succès.` 
        });
      }

      return res.status(400).json({ success: false, error: "Identifiant manquant pour la suppression." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
