import { prisma } from './_db.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const vessels = await prisma.vessels.findMany({
        where: { deleted_at: null },
        orderBy: { id: 'desc' }
      });
      
      const mappedVessels = vessels.map((v: any) => ({
        id: Number(v.id),
        nom: v.nom,
        imo: v.imo || undefined,
        armateur: v.armateur || undefined,
        statut: v.statut || 'ACTIF',
        createdBy: v.created_by,
        deletedAt: v.deleted_at?.toISOString()
      }));

      return res.status(200).json({ success: true, vessels: mappedVessels });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const vessel = req.body;
      if (!vessel || !vessel.nom) {
        return res.status(400).json({ success: false, error: 'Missing vessel object or vessel nom.' });
      }

      await prisma.vessels.upsert({
        where: { imo_number: vessel.imo || '' },
        update: {
          nom: vessel.nom,
          armateur: vessel.armateur,
          callsign: vessel.callsign || '',
          pavillon: vessel.pavillon || ''
        },
        create: {
          imo_number: vessel.imo || '',
          nom: vessel.nom,
          armateur: vessel.armateur,
          callsign: vessel.callsign || '',
          pavillon: vessel.pavillon || ''
        }
      });

      return res.status(200).json({ success: true, message: 'Vessel saved successfully.' });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
