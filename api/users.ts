import crypto from 'crypto';
import { prisma } from './_db.js';

// Helper pour gérer le BigInt
const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
));

// Secure Password Hashing with PBKDF2 (SHA-512, 10,000 iterations, 16-byte random salt)
function hashPassword(password: string): string {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password.trim(), salt, 10000, 64, 'sha512').toString('hex');
  return `pbkdf2$10000$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  if (!storedHash.startsWith('pbkdf2$')) {
    // Plain text legacy fallback
    return storedHash.trim() === password.trim();
  }
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const originalHash = parts[3];
  try {
    const hash = crypto.pbkdf2Sync(password.trim(), salt, iterations, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  const method = req.method;

  if (method === 'GET') {
    try {
      const users = await prisma.users.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          nom_complet: true,
          email: true,
          role: true,
          telephone: true,
          nom_societe: true,
          pays: true,
          est_actif: true,
          date_creation: true,
          dernier_acces: true
        }
      });

      const mappedUsers = users.map(u => ({
        ...u,
        id: Number(u.id),
        nomComplet: u.nom_complet,
        nomSociete: u.nom_societe,
        estActif: Boolean(u.est_actif),
        dateCreation: u.date_creation,
        dernierAcces: u.dernier_acces
      }));

      return res.status(200).json({ success: true, users: serialize(mappedUsers) });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (method === 'POST') {
    try {
      const data = req.body;
      if (!data) {
        return res.status(400).json({ success: false, error: 'Missing request body' });
      }

      // Login check action
      if (data.action === 'login') {
        const { email, password } = data;
        if (!email || !password) {
          return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
        }

        const found = await prisma.users.findMany({
          where: {
            email: {
              equals: email.trim(),
              mode: 'insensitive'
            }
          },
          take: 1
        });

        if (found.length === 0) {
          return res.status(401).json({ success: false, error: 'Identifiants incorrects ou compte inexistant.' });
        }

        const user = found[0];
        if (!user.est_actif) {
          return res.status(403).json({ success: false, error: 'Ce compte a été désactivé par l\'administrateur.' });
        }

        const isPasswordValid = verifyPassword(password, user.mot_de_passe || '');
        if (!isPasswordValid) {
          return res.status(401).json({ success: false, error: 'Mot de passe incorrect.' });
        }

        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
        if (user.mot_de_passe && !user.mot_de_passe.startsWith('pbkdf2$')) {
          const upgradedHash = hashPassword(password);
          await prisma.users.update({
            where: { id: user.id },
            data: { dernier_acces: nowStr, mot_de_passe: upgradedHash }
          });
        } else {
          await prisma.users.update({
            where: { id: user.id },
            data: { dernier_acces: nowStr }
          });
        }

        const userSafe = {
          id: Number(user.id),
          nomComplet: user.nom_complet,
          email: user.email,
          role: user.role,
          telephone: user.telephone,
          nomSociete: user.nom_societe,
          pays: user.pays,
          estActif: Boolean(user.est_actif),
          dateCreation: user.date_creation,
          dernierAcces: nowStr
        };

        return res.status(200).json({ success: true, user: serialize(userSafe) });
      }

      if (data.action === 'request_password_reset') {
        const { email } = data;
        if (!email) {
          return res.status(400).json({ success: false, error: 'Email requis.' });
        }
        const user = await prisma.users.findFirst({
          where: { email: { equals: email.trim(), mode: 'insensitive' } }
        });
        if (!user) {
          return res.status(404).json({ success: false, error: 'Aucun compte associé à cet email.' });
        }
        return res.status(200).json({ success: true, message: 'Si l\'email existe, un code a été envoyé (simulation).' });
      }

      // Add/Update user
      if (data.action === 'upsert' && data.user) {
        const { user } = data;
        
        let hash = user.motDePasse || null;
        if (user.motDePasse && !user.motDePasse.startsWith('pbkdf2$')) {
          hash = hashPassword(user.motDePasse);
        }

        const upsertData = {
          nom_complet: user.nomComplet,
          email: user.email,
          role: user.role,
          telephone: user.telephone || null,
          nom_societe: user.nomSociete || null,
          pays: user.pays || null,
          est_actif: user.estActif !== undefined ? user.estActif : true,
          mot_de_passe: hash
        };

        if (user.id) {
          await prisma.users.update({
            where: { id: user.id },
            data: upsertData
          });
        } else {
          await prisma.users.create({
            data: {
              id: BigInt(Date.now()),
              ...upsertData,
              date_creation: new Date().toISOString().replace('T', ' ').substring(0, 19)
            }
          });
        }

        return res.status(200).json({ success: true, message: 'Utilisateur enregistré.' });
      }

      return res.status(400).json({ success: false, error: 'Action non reconnue.' });
    } catch (error: any) {
      console.error('Error saving user:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (method === 'DELETE') {
    try {
      const rawId = req.query.id || req.body?.id;
      const userId = Number(rawId);
      if (!rawId || isNaN(userId)) {
        return res.status(400).json({ success: false, error: "ID utilisateur invalide." });
      }

      await prisma.users.delete({ where: { id: userId } });
      return res.status(200).json({ success: true, message: "Utilisateur supprimé." });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
}
