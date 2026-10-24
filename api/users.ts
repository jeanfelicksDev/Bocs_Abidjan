import { randomBytes, randomInt, createHash } from 'node:crypto';
import { sql } from './_db.js';
import {
  ALL_ROLES,
  Role,
  SessionUser,
  clearSessionCookie,
  getSessionUser,
  hashPassword,
  isPasswordHash,
  requireAuth,
  sendServerError,
  setSessionCookie,
  validatePasswordStrength,
  verifyPassword,
  writeAudit
} from './_auth.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_LOGIN_ERROR = 'Identifiants incorrects ou compte inexistant.';
const GENERIC_RESET_MESSAGE = 'Si un compte actif correspond à cette adresse, un code de sécurité a été émis.';

// Colonnes de sécurité (verrouillage, tentatives de reset) — créées une fois par instance.
let authSchemaReady: Promise<unknown> | null = null;
const ensureAuthSchema = () => {
  authSchemaReady ??= Promise.all([
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INT DEFAULT 0;`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until BIGINT;`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_attempts INT DEFAULT 0;`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(128);`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry VARCHAR(50);`
  ]).catch((err) => { authSchemaReady = null; throw err; });
  return authSchemaReady;
};

const toPublicUser = (u: any) => ({
  id: Number(u.id),
  nomComplet: u.nomComplet,
  email: u.email,
  role: u.role,
  telephone: u.telephone,
  nomSociete: u.nomSociete,
  pays: u.pays,
  estActif: Boolean(u.estActif),
  dateCreation: u.dateCreation,
  dernierAcces: u.dernierAcces
});
const hashResetCode = (code: string) => createHash('sha256').update(code).digest('hex');
const isRole = (value: unknown): value is Role => ALL_ROLES.includes(value as Role);
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value.trim() : undefined);

export default async function handler(req: any, res: any) {
  try {
    await ensureAuthSchema();
    switch (req.method) {
      case 'GET': return await handleGet(req, res);
      case 'POST': return await handlePost(req, res);
      case 'PUT': return await handlePut(req, res);
      case 'DELETE': return await handleDelete(req, res);
      default: return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
  } catch (error) {
    return sendServerError(res, error, 'users');
  }
}

async function selectUsers(where: { id?: number; email?: string }) {
  if (where.id !== undefined) {
    return sql`
      SELECT id, nom_complet as "nomComplet", email, role, telephone, nom_societe as "nomSociete", pays,
        est_actif as "estActif", date_creation as "dateCreation", dernier_acces as "dernierAcces"
      FROM users WHERE id = ${where.id};
    `;
  }
  return sql`
    SELECT id, nom_complet as "nomComplet", email, role, telephone, nom_societe as "nomSociete", pays,
      est_actif as "estActif", date_creation as "dateCreation", dernier_acces as "dernierAcces"
    FROM users ORDER BY id ASC;
  `;
}

// ─── GET : ADMIN → tous les comptes ; autres → leur propre compte ──────────
async function handleGet(req: any, res: any) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const rows = session.role === 'ADMIN' && !req.query?.me
    ? await selectUsers({})
    : await selectUsers({ id: session.id });
  const users = rows.map(toPublicUser);

  if (req.query?.me) return res.status(200).json({ success: true, user: users[0] });
  return res.status(200).json({ success: true, users });
}

// ─── POST : login / logout / reset / création de compte ────────────────────
async function handlePost(req: any, res: any) {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ success: false, error: 'Missing request body' });
  }

  switch (data.action) {
    case 'login': return login(req, res, data);
    case 'logout':
      clearSessionCookie(res);
      return res.status(200).json({ success: true });
    case 'request_password_reset': return requestPasswordReset(res, data);
    case 'confirm_password_reset': return confirmPasswordReset(res, data);
    default: return createUser(req, res, data);
  }
}

async function login(req: any, res: any, data: any) {
  const email = str(data.email);
  const password = str(data.password);
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
  }

  const found = await sql`
    SELECT id, nom_complet as "nomComplet", email, role, telephone, nom_societe as "nomSociete", pays,
      est_actif as "estActif", date_creation as "dateCreation", dernier_acces as "dernierAcces",
      mot_de_passe as "motDePasse", failed_login_count as "failedLoginCount", locked_until as "lockedUntil"
    FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1;
  `;
  const user = found[0];
  if (!user) return res.status(401).json({ success: false, error: GENERIC_LOGIN_ERROR });

  if (user.lockedUntil && Date.now() < Number(user.lockedUntil)) {
    return res.status(429).json({ success: false, error: 'Compte temporairement verrouillé après plusieurs échecs. Réessayez dans 15 minutes.' });
  }

  if (!(await verifyPassword(password, user.motDePasse))) {
    // Incrément atomique (résiste aux rafales de requêtes parallèles), verrouillage au seuil.
    await sql`
      UPDATE users
      SET failed_login_count = CASE WHEN COALESCE(failed_login_count, 0) + 1 >= ${MAX_FAILED_LOGINS} THEN 0
                                    ELSE COALESCE(failed_login_count, 0) + 1 END,
          locked_until = CASE WHEN COALESCE(failed_login_count, 0) + 1 >= ${MAX_FAILED_LOGINS}
                              THEN ${Date.now() + LOCK_DURATION_MS} ELSE locked_until END
      WHERE id = ${user.id};
    `;
    return res.status(401).json({ success: false, error: GENERIC_LOGIN_ERROR });
  }

  if (!user.estActif) {
    return res.status(403).json({ success: false, error: 'Ce compte a été désactivé par l\'administrateur.' });
  }

  // Migration paresseuse : un mot de passe encore en clair est haché à la première connexion.
  const upgradedHash = isPasswordHash(user.motDePasse) ? null : await hashPassword(password);
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  await sql`
    UPDATE users
    SET dernier_acces = ${nowStr}, failed_login_count = 0, locked_until = NULL,
        mot_de_passe = COALESCE(${upgradedHash}, mot_de_passe)
    WHERE id = ${user.id};
  `;

  const publicUser = { ...toPublicUser(user), dernierAcces: nowStr };
  setSessionCookie(res, publicUser.id);
  await writeAudit(req, publicUser, 'CONNEXION_REUSSIE', 'Session', `Connexion de ${publicUser.nomComplet} (${publicUser.role})`);
  return res.status(200).json({ success: true, user: publicUser });
}

async function requestPasswordReset(res: any, data: any) {
  const email = str(data.email);
  if (!email) return res.status(400).json({ success: false, error: 'Email requis.' });

  const found = await sql`
    SELECT id, est_actif as "estActif" FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1;
  `;
  const user = found[0];
  // Réponse identique que le compte existe ou non (pas d'énumération des comptes).
  if (!user || !user.estActif) return res.status(200).json({ success: true, message: GENERIC_RESET_MESSAGE });

  const resetCode = randomInt(100000, 1000000).toString();
  const expiry = (Date.now() + RESET_CODE_TTL_MS).toString();
  await sql`
    UPDATE users SET reset_token = ${hashResetCode(resetCode)}, reset_token_expiry = ${expiry}, reset_attempts = 0
    WHERE id = ${user.id};
  `;

  // Aucun canal e-mail/SMS n'est encore branché : le code n'est renvoyé au navigateur que si
  // le mode démo est explicitement activé (ALLOW_DEMO_RESET_CODE=true). À laisser désactivé en production.
  const demoResetCode = process.env.ALLOW_DEMO_RESET_CODE === 'true' ? resetCode : undefined;
  return res.status(200).json({ success: true, message: GENERIC_RESET_MESSAGE, demoResetCode });
}

async function confirmPasswordReset(res: any, data: any) {
  const email = str(data.email);
  const resetCode = str(data.resetCode);
  const newPassword = str(data.newPassword);
  if (!email || !resetCode || !newPassword) {
    return res.status(400).json({ success: false, error: 'Tous les champs sont obligatoires.' });
  }
  const weakness = validatePasswordStrength(newPassword);
  if (weakness) return res.status(400).json({ success: false, error: weakness });

  // La tentative est comptée AVANT la comparaison, de façon atomique (pas de rafale parallèle possible).
  const attempt = await sql`
    UPDATE users SET reset_attempts = COALESCE(reset_attempts, 0) + 1
    WHERE LOWER(email) = LOWER(${email}) AND reset_token IS NOT NULL
    RETURNING id, reset_token as "resetToken", reset_token_expiry as "resetTokenExpiry", reset_attempts as "resetAttempts";
  `;
  const user = attempt[0];
  const invalid = () => res.status(400).json({ success: false, error: 'Code de sécurité invalide ou expiré.' });
  if (!user) return invalid();

  const expired = !user.resetTokenExpiry || Date.now() > Number(user.resetTokenExpiry);
  const tooManyAttempts = Number(user.resetAttempts) > MAX_RESET_ATTEMPTS;
  if (expired || tooManyAttempts) {
    await sql`UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ${user.id};`;
    return invalid();
  }

  const codeHash = hashResetCode(resetCode);
  if (user.resetToken !== codeHash) return invalid();

  // Consommation unique du code : seule la première requête valide modifie le mot de passe.
  const consumed = await sql`
    UPDATE users
    SET mot_de_passe = ${await hashPassword(newPassword)}, reset_token = NULL, reset_token_expiry = NULL,
        reset_attempts = 0, failed_login_count = 0, locked_until = NULL
    WHERE id = ${user.id} AND reset_token = ${codeHash}
    RETURNING id;
  `;
  if (consumed.length === 0) return invalid();
  return res.status(200).json({
    success: true,
    message: 'Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter.'
  });
}

/** Création : ADMIN → tout rôle ; sinon auto-inscription limitée au rôle CLIENT_EXPORT. */
async function createUser(req: any, res: any, data: any) {
  const session = await getSessionUser(req);
  const isAdmin = session?.role === 'ADMIN';

  const email = str(data.email)?.toLowerCase();
  // Compte créé par l'ADMIN sans mot de passe : mot de passe temporaire aléatoire, renvoyé une seule fois.
  const temporaryPassword = isAdmin && !str(data.motDePasse) && !str(data.password)
    ? `BOCS-${randomBytes(9).toString('base64url')}`
    : undefined;
  const password = temporaryPassword || str(data.motDePasse) || str(data.password);
  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ success: false, error: 'Email obligatoire et valide.' });
  }
  const weakness = validatePasswordStrength(password);
  if (weakness) return res.status(400).json({ success: false, error: weakness });

  const role: Role = isAdmin && isRole(data.role) ? data.role : 'CLIENT_EXPORT';
  const estActif = isAdmin && data.estActif !== undefined ? Boolean(data.estActif) : true;
  const requestedId = Number(data.id);
  const id = isAdmin && Number.isSafeInteger(requestedId) && requestedId > 0 ? requestedId : Date.now();
  const nomComplet = str(data.nomComplet)?.slice(0, 255) || 'Utilisateur';
  const telephone = str(data.telephone)?.slice(0, 50) || null;
  const nomSociete = str(data.nomSociete)?.slice(0, 255) || null;
  const pays = str(data.pays)?.slice(0, 100) || 'Côte d\'Ivoire';
  const dateCreation = new Date().toISOString().split('T')[0];

  const existing = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email});`;
  if (existing.length > 0) {
    return res.status(409).json({ success: false, error: 'Un compte avec cette adresse email existe déjà.' });
  }

  await sql`
    INSERT INTO users (id, nom_complet, email, role, telephone, nom_societe, pays, est_actif, mot_de_passe, date_creation, dernier_acces)
    VALUES (${id}, ${nomComplet}, ${email}, ${role}, ${telephone}, ${nomSociete}, ${pays}, ${estActif}, ${await hashPassword(password!)}, ${dateCreation}, NULL);
  `;

  const user = { id, nomComplet, email, role, telephone, nomSociete, pays, estActif, dateCreation, dernierAcces: null };
  if (isAdmin) {
    await writeAudit(req, session!, 'CREATION_UTILISATEUR', 'User', `Création du compte ${nomComplet} (${role})`);
  } else {
    await writeAudit(req, user, 'INSCRIPTION_CLIENT', 'User', `Nouveau compte client ${nomComplet} (${email})`);
  }
  return res.status(201).json({ success: true, user, temporaryPassword });
}

// ─── PUT : changement de mot de passe / mise à jour de profil ──────────────
async function handlePut(req: any, res: any) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const data = req.body || {};
  const id = Number(data.id || req.query?.id);
  if (!id || isNaN(id)) {
    return res.status(400).json({ success: false, error: 'ID utilisateur manquant ou invalide.' });
  }
  if (session.role !== 'ADMIN' && id !== session.id) {
    return res.status(403).json({ success: false, error: 'Vous ne pouvez modifier que votre propre compte.' });
  }

  if (data.action === 'change_password') return changePassword(res, session, id, data);
  return updateUser(req, res, session, id, data);
}

async function changePassword(res: any, session: SessionUser, id: number, data: any) {
  const newPassword = str(data.newPassword);
  const weakness = validatePasswordStrength(newPassword);
  if (weakness) return res.status(400).json({ success: false, error: weakness });

  const rows = await sql`SELECT mot_de_passe FROM users WHERE id = ${id};`;
  if (rows.length === 0) return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });

  // L'ancien mot de passe est toujours exigé pour son propre compte.
  if (id === session.id && !(await verifyPassword(str(data.currentPassword) || '', rows[0].mot_de_passe))) {
    return res.status(401).json({ success: false, error: 'L\'ancien mot de passe est incorrect.' });
  }

  await sql`UPDATE users SET mot_de_passe = ${await hashPassword(newPassword!)} WHERE id = ${id};`;
  return res.status(200).json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
}

async function updateUser(req: any, res: any, session: SessionUser, id: number, data: any) {
  const isAdmin = session.role === 'ADMIN';
  const email = str(data.email)?.toLowerCase();
  if (email !== undefined && !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ success: false, error: 'Email invalide.' });
  }

  // Seul l'ADMIN peut changer rôle, statut et mot de passe d'un tiers (champs sensibles).
  const role = isAdmin && isRole(data.role) ? data.role : null;
  const estActif = isAdmin && data.estActif !== undefined && id !== session.id ? Boolean(data.estActif) : null;
  const adminPassword = isAdmin && id !== session.id ? str(data.motDePasse) : undefined;
  if (adminPassword) {
    const weakness = validatePasswordStrength(adminPassword);
    if (weakness) return res.status(400).json({ success: false, error: weakness });
  }
  const passwordHash = adminPassword ? await hashPassword(adminPassword) : null;

  await sql`
    UPDATE users
    SET
      nom_complet = COALESCE(${str(data.nomComplet)?.slice(0, 255) ?? null}, nom_complet),
      email = COALESCE(${email ?? null}, email),
      role = COALESCE(${role}, role),
      telephone = COALESCE(${str(data.telephone)?.slice(0, 50) ?? null}, telephone),
      nom_societe = COALESCE(${str(data.nomSociete)?.slice(0, 255) ?? null}, nom_societe),
      pays = COALESCE(${str(data.pays)?.slice(0, 100) ?? null}, pays),
      est_actif = COALESCE(${estActif}, est_actif),
      mot_de_passe = COALESCE(${passwordHash}, mot_de_passe)
    WHERE id = ${id};
  `;

  if (isAdmin && id !== session.id) {
    await writeAudit(req, session, 'MODIFICATION_UTILISATEUR', 'User', `Mise à jour du compte #${id}`);
  }
  return res.status(200).json({ success: true, message: 'Utilisateur mis à jour avec succès.' });
}

// ─── DELETE : ADMIN uniquement, jamais son propre compte ───────────────────
async function handleDelete(req: any, res: any) {
  const session = await requireAuth(req, res, ['ADMIN']);
  if (!session) return;

  const id = Number(req.query?.id || req.body?.id);
  if (!id || isNaN(id)) {
    return res.status(400).json({ success: false, error: 'ID utilisateur manquant ou invalide.' });
  }
  if (id === session.id) {
    return res.status(400).json({ success: false, error: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }

  await sql`DELETE FROM users WHERE id = ${id};`;
  await writeAudit(req, session, 'SUPPRESSION_UTILISATEUR', 'User', `Suppression du compte #${id}`);
  return res.status(200).json({ success: true, message: 'Utilisateur supprimé avec succès.' });
}
