import { prisma } from './_db.js';

const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
));

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const logs = await prisma.audit_logs.findMany({
        orderBy: { id: 'desc' }
      });

      const mapped = logs.map((l: any) => ({
        ...l,
        id: Number(l.id),
        utilisateurNom: l.utilisateur_nom,
        dateAction: l.date_action
      }));

      return res.status(200).json({ success: true, auditLogs: serialize(mapped) });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const log = req.body;
      if (!log) {
        return res.status(400).json({ success: false, error: "Missing log object." });
      }

      const forwarded = req.headers['x-forwarded-for'];
      const realIp = req.headers['x-real-ip'];
      const clientIp = (forwarded ? forwarded.toString().split(',')[0].trim() : null) ||
                       (realIp ? realIp.toString().trim() : null) ||
                       req.socket?.remoteAddress ||
                       log.ip ||
                       '127.0.0.1';

      await prisma.audit_logs.create({
        data: {
          id: log.id,
          utilisateur_nom: log.utilisateurNom || '',
          role: log.role || '',
          action: log.action || '',
          entite: log.entite || '',
          details: log.details || '',
          date_action: log.dateAction || '',
          ip: clientIp
        }
      });

      return res.status(200).json({ success: true, message: "Audit log saved successfully.", ip: clientIp });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
