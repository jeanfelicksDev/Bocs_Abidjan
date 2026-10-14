import { prisma } from './_db.js';

/** `imo_number` est obligatoire et unique : un navire sans IMO reçoit un identifiant technique, masqué côté client. */
const NO_IMO_PREFIX = 'SANS-IMO-';

const toClient = (v: any) => ({
  id: Number(v.id),
  nom: v.nom,
  callsign: v.callsign || '',
  pavillon: v.pavillon || undefined,
  armateur: v.armateur || undefined,
  coque: v.armateur || undefined,
  dwt: v.tonnage ?? undefined,
  imoNumber: v.imo_number && !v.imo_number.startsWith(NO_IMO_PREFIX) ? v.imo_number : undefined,
  deletedAt: v.deleted_at?.toISOString()
});

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const vessels = await prisma.vessels.findMany({
        where: { deleted_at: null },
        orderBy: { id: 'desc' }
      });
      return res.status(200).json({ success: true, vessels: vessels.map(toClient) });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const vessel = req.body;
      const nom = typeof vessel?.nom === 'string' ? vessel.nom.trim() : '';
      if (!nom) {
        return res.status(400).json({ success: false, error: 'Missing vessel object or vessel nom.' });
      }
      const imo = typeof vessel.imoNumber === 'string' && vessel.imoNumber.trim() ? vessel.imoNumber.trim() : null;
      const id = vessel.id != null && !isNaN(Number(vessel.id)) ? BigInt(Math.trunc(Number(vessel.id))) : null;

      // Navire existant : même id (modification), sinon même IMO, sinon même nom (pas de doublon).
      const existing =
        (id != null ? await prisma.vessels.findUnique({ where: { id } }) : null) ||
        (imo ? await prisma.vessels.findUnique({ where: { imo_number: imo } }) : null) ||
        (await prisma.vessels.findFirst({ where: { deleted_at: null, nom: { equals: nom, mode: 'insensitive' } } }));

      const fields = {
        nom,
        callsign: vessel.callsign || '',
        pavillon: vessel.pavillon || '',
        armateur: vessel.armateur || vessel.coque || null,
        tonnage: typeof vessel.dwt === 'number' ? vessel.dwt : null
      };

      const saved = existing
        ? await prisma.vessels.update({
            where: { id: existing.id },
            data: { ...fields, deleted_at: null, ...(imo ? { imo_number: imo } : {}) }
          })
        : await prisma.vessels.create({
            data: {
              ...fields,
              // L'id choisi par le client est conservé pour que sa sélection reste valide.
              ...(id != null ? { id } : {}),
              imo_number: imo || `${NO_IMO_PREFIX}${id ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            }
          });

      return res.status(200).json({ success: true, vessel: toClient(saved) });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const rawId = req.query.id || req.body?.id;
      if (!rawId || isNaN(Number(rawId))) {
        return res.status(400).json({ success: false, error: 'Missing or invalid vessel ID.' });
      }
      // Suppression logique : les escales gardent le nom du navire, l'historique reste lisible.
      const result = await prisma.vessels.updateMany({
        where: { id: BigInt(Math.trunc(Number(rawId))) },
        data: { deleted_at: new Date() }
      });
      if (result.count === 0) {
        return res.status(404).json({ success: false, error: 'Navire introuvable.' });
      }
      return res.status(200).json({ success: true, message: 'Vessel deleted successfully.' });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }
}
