import { sql } from './db';

export default async function handler(req: any, res: any) {
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
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const log = req.body;
      if (!log) {
        return res.status(400).json({ success: false, error: "Missing log object." });
      }

      await sql`
        INSERT INTO audit_logs (
          id, utilisateur_nom, role, action, entite, details, date_action, ip
        ) VALUES (
          ${log.id}, ${log.utilisateurNom}, ${log.role}, ${log.action}, ${log.entite}, ${log.details}, ${log.dateAction}, ${log.ip}
        );
      `;

      return res.status(200).json({ success: true, message: "Audit log saved successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
}
