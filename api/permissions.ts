import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const perms = await prisma.role_permissions.findMany();
      return res.status(200).json(perms);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      const matrix = Array.isArray(body) ? body : body.matrix;
      
      if (!Array.isArray(matrix)) {
        return res.status(400).json({ error: 'Invalid payload, expected array' });
      }

      // Vider et remplacer la matrice
      await prisma.$transaction(async (tx) => {
        await tx.role_permissions.deleteMany();
        
        // Convert the frontend structure to the DB structure
        // Frontend has: [{ id: 'view_escales', roles: { ADMIN: true, AGENT_IMPORT: false, ... } }, ...]
        const insertData = [];
        for (const item of matrix) {
          if (!item.id || !item.roles) continue;
          for (const [role, isGranted] of Object.entries(item.roles)) {
            if (isGranted) {
              insertData.push({
                role: role,
                permission_code: item.id
              });
            }
          }
        }
        
        if (insertData.length > 0) {
          await tx.role_permissions.createMany({
            data: insertData
          });
        }
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error saving permissions:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
