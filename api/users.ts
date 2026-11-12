import crypto from 'crypto';
import { prisma } from './_db.js';
import {
  protect,

  isClient,
  setSessionCookie,
  clearSessionCookie,
  loginBlocked,
  recordLoginResult,
  forgetCachedUser,
  viaClientPortal,
  PORTAL_STAFF_REFUSED,
  type SessionUser
} from './_auth.js';

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

const ROLES = ['ADMIN', 'AGENT_IMPORT', 'AGENT_EXPORT', 'COMPTABILITE', 'CLIENT_EXPORT'];
const MIN_PASSWORD = 8;
const nowStr = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

/** Compte tel qu'envoyé au navigateur : jamais le mot de passe ni le jeton de réinitialisation. */
const toClient = (u: any) => ({
  id: Number(u.id),
  nomComplet: u.nom_complet,
  email: u.email,
  role: u.role,
  telephone: u.telephone,
  nomSociete: u.nom_societe,
  pays: u.pays,
  estActif: Boolean(u.est_actif),
  dateCreation: u.date_creation,
  dernierAcces: u.dernier_acces
});

const SAFE_SELECT = {
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
} as const;

async function login(req: any, res: any, data: any) {
  const email = String(data.email || '').trim();
  const password = String(data.password || '');
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
  }
  if (loginBlocked(req, email)) {
    return res.status(429).json({ success: false, error: 'Trop de tentatives : réessayez dans 15 minutes.' });
  }

  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deleted_at: null }
  });
  // Même réponse pour un compte inconnu et un mauvais mot de passe : on ne révèle pas
  // quels e-mails existent.
  if (!user || !verifyPassword(password, user.mot_de_passe || '')) {
    recordLoginResult(req, email, false);
    return res.status(401).json({ success: false, error: 'Identifiants incorrects.' });
  }
  if (!user.est_actif) {
    return res.status(403).json({ success: false, error: 'Ce compte a été désactivé par l\'administrateur.' });
  }
  recordLoginResult(req, email, true);
  if (viaClientPortal(req) && user.role !== 'CLIENT_EXPORT') {
    return res.status(403).json({ success: false, error: PORTAL_STAFF_REFUSED });
  }

  const dernierAcces = nowStr();
  await prisma.users.update({
    where: { id: user.id },
    data: {
      dernier_acces: dernierAcces,
      // Mot de passe historique en clair : remplacé par son empreinte à la première connexion.
      ...(user.mot_de_passe && !user.mot_de_passe.startsWith('pbkdf2$') ? { mot_de_passe: hashPassword(password) } : {})
    }
  });
  setSessionCookie(req, res, Number(user.id));
  return res.status(200).json({ success: true, user: serialize({ ...toClient(user), dernierAcces }) });
}

async function changePassword(req: any, res: any, data: any, me: SessionUser) {
  const userId = Number(data.id ?? me.id);
  if (userId !== me.id && me.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Vous ne pouvez changer que votre propre mot de passe.' });
  }
  const newPassword = String(data.newPassword || '');
  if (newPassword.trim().length < MIN_PASSWORD) {
    return res.status(400).json({ success: false, error: `Le mot de passe doit comporter au moins ${MIN_PASSWORD} caractères.` });
  }
  const user = await prisma.users.findUnique({ where: { id: BigInt(userId) } });
  if (!user) return res.status(404).json({ success: false, error: 'Compte introuvable.' });
  // L'ancien mot de passe est exigé pour son propre compte.
  if (userId === me.id && !verifyPassword(String(data.currentPassword || ''), user.mot_de_passe || '')) {
    return res.status(400).json({ success: false, error: 'Mot de passe actuel incorrect.' });
  }
  await prisma.users.update({ where: { id: user.id }, data: { mot_de_passe: hashPassword(newPassword) } });
  return res.status(200).json({ success: true, message: 'Mot de passe modifié.' });
}

/**
 * Création / modification d'un compte. L'administrateur gère tous les comptes ;
 * les autres ne modifient que leur propre fiche, sans toucher à leur rôle ni à
 * leur statut. Le mot de passe n'est changé que s'il est fourni.
 */
async function saveUser(req: any, res: any, input: any, me: SessionUser) {
  const isAdmin = me.role === 'ADMIN';
  const id = input.id !== undefined && input.id !== null && !isNaN(Number(input.id)) ? Number(input.id) : null;
  const existing = id !== null ? await prisma.users.findUnique({ where: { id: BigInt(id) } }) : null;

  if (!isAdmin && (!existing || id !== me.id)) {
    return res.status(403).json({ success: false, error: 'Seul l\'administrateur gère les comptes.' });
  }

  // Réinitialisation par l'administrateur : { id, motDePasse } seuls.
  const passwordOnly = existing && input.motDePasse && !input.email && !input.nomComplet;

  const data: Record<string, unknown> = {};
  if (!passwordOnly) {
    const email = String(input.email ?? existing?.email ?? '').trim();
    const nomComplet = String(input.nomComplet ?? existing?.nom_complet ?? '').trim();
    if (!email || !nomComplet) {
      return res.status(400).json({ success: false, error: 'Nom et e-mail obligatoires.' });
    }
    Object.assign(data, {
      nom_complet: nomComplet,
      email,
      telephone: input.telephone ?? existing?.telephone ?? null,
      nom_societe: input.nomSociete ?? existing?.nom_societe ?? null,
      pays: input.pays ?? existing?.pays ?? null
    });
    if (isAdmin) {
      const role = String(input.role ?? existing?.role ?? '');
      if (!ROLES.includes(role)) return res.status(400).json({ success: false, error: 'Rôle inconnu.' });
      data.role = role;
      data.est_actif = input.estActif !== undefined ? Boolean(input.estActif) : existing?.est_actif ?? true;
      // L'administrateur ne peut ni se rétrograder ni se désactiver lui-même (plus personne ne gérerait les comptes).
      if (id === me.id && (data.role !== 'ADMIN' || data.est_actif === false)) {
        return res.status(400).json({ success: false, error: 'Vous ne pouvez pas retirer vos propres droits d\'administrateur.' });
      }
    }
  }
  const motDePasse = typeof input.motDePasse === 'string' ? input.motDePasse.trim() : '';
  if (motDePasse) {
    if (!isAdmin) {
      return res.status(400).json({ success: false, error: 'Changez votre mot de passe depuis « Mon compte ».' });
    }
    if (motDePasse.length < MIN_PASSWORD) {
      return res.status(400).json({ success: false, error: `Le mot de passe doit comporter au moins ${MIN_PASSWORD} caractères.` });
    }
    data.mot_de_passe = hashPassword(motDePasse);
  }

  const saved = existing
    ? await prisma.users.update({ where: { id: existing.id }, data, select: SAFE_SELECT })
    : await prisma.users.create({
        data: {
          id: BigInt(id ?? Date.now()),
          role: 'CLIENT_EXPORT',
          est_actif: true,
          ...data,
          date_creation: nowStr()
        } as any,
        select: SAFE_SELECT
      });
  forgetCachedUser(Number(saved.id));
  return res.status(200).json({ success: true, message: 'Utilisateur enregistré.', user: serialize(toClient(saved)) });
}

async function handler(req: any, res: any) {
  const method = req.method;
  const me: SessionUser | null = req.user;

  if (method === 'GET') {
    try {
      // Session courante : l'application vérifie au démarrage que la connexion est toujours valable.
      if (req.query?.session !== undefined) {
        const row = await prisma.users.findUnique({ where: { id: BigInt(me!.id) }, select: SAFE_SELECT });
        return res.status(200).json({ success: true, user: serialize(toClient(row)) });
      }
      const users = await prisma.users.findMany({
        where: { deleted_at: null, ...(isClient(me) ? { id: BigInt(me!.id) } : {}) },
        orderBy: { id: 'asc' },
        select: SAFE_SELECT
      });
      return res.status(200).json({ success: true, users: serialize(users.map(toClient)) });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (method === 'POST' || method === 'PUT') {
    try {
      const data = req.body;
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ success: false, error: 'Missing request body' });
      }

      if (data.action === 'login') return await login(req, res, data);

      if (data.action === 'logout') {
        clearSessionCookie(req, res);
        return res.status(200).json({ success: true });
      }

      if (data.action === 'request_password_reset') {
        // Réponse identique que le compte existe ou non (pas d'énumération des e-mails).
        return res.status(200).json({
          success: true,
          message: 'Si ce compte existe, l\'administrateur BOCS peut réinitialiser son mot de passe.'
        });
      }

      // Toutes les autres actions exigent une session.
      if (!me) return res.status(401).json({ success: false, error: 'Session expirée ou absente : reconnectez-vous.' });

      if (data.action === 'change_password') return await changePassword(req, res, data, me);
      if (data.action === 'upsert' && data.user) return await saveUser(req, res, data.user, me);
      if (!data.action && (data.id !== undefined || data.email)) return await saveUser(req, res, data, me);

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
      if (userId === me!.id) {
        return res.status(400).json({ success: false, error: 'Vous ne pouvez pas supprimer votre propre compte.' });
      }

      await prisma.users.delete({ where: { id: BigInt(userId) } });
      forgetCachedUser(userId);
      return res.status(200).json({ success: true, message: "Utilisateur supprimé." });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
  return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
}

export default protect(
  {
    // POST/PUT : la connexion et la déconnexion sont publiques, le reste est contrôlé ci-dessus.
    access: { GET: 'user', POST: 'public', PUT: 'user', DELETE: ['ADMIN'] }
  },
  handler
);

