import { sql } from './_db.js';
import { requireAuth, sendServerError, clientIp, ALL_ROLES, ADMIN_ONLY } from './_auth.js';

export default async function handler(req: any, res: any) {
  const session = await requireAuth(req, res, req.method === "GET" ? ADMIN_ONLY : ALL_ROLES);
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const logs = await sql`
        SELECT 
          id, 
          utilisateur_nom as "utilisateurNom", 
          role, 
          action, 
          entite, 
          details,
          date_action as "dateAction",
          ip
        FROM audit_logs 
        ORDER BY id DESC;
      `;

      const mapped = logs.map((l: any) => ({
        ...l,
        id: Number(l.id)
      }));

      return res.status(200).json({ success: true, auditLogs: mapped });
    } catch (error: any) {
      return sendServerError(res, error, 'audit');
    }
  } else if (req.method === 'POST') {
    try {
      const log = req.body;
      if (!log) {
        return res.status(400).json({ success: false, error: "Missing log object." });
      }

      // Identité, rôle, horodatage et IP sont imposés par le serveur (traces non falsifiables).
      const logId = Date.now() * 1000 + Math.floor(Math.random() * 1000); // id serveur, sans collision avec l'id client
      const dateAction = new Date().toISOString().replace('T', ' ').substring(0, 19);
      await sql`
        INSERT INTO audit_logs (
          id, utilisateur_nom, role, action, entite, details, date_action, ip
        ) VALUES (
          ${logId}, ${session.nomComplet}, ${session.role}, ${String(log.action ?? '').slice(0, 100)},
          ${String(log.entite ?? '').slice(0, 100)}, ${String(log.details ?? '').slice(0, 2000)}, ${dateAction}, ${clientIp(req)}
        );
      `;

      return res.status(200).json({ success: true, message: "Audit log saved successfully." });
    } catch (error: any) {
      return sendServerError(res, error, 'audit');
    }
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
