// ═══════════════════════════════════════════════════════════════════════════
// SÉCURITÉ API BOCS — authentification serveur, sessions signées et RBAC.
//
// - Mots de passe hachés (scrypt + sel aléatoire), jamais renvoyés au client.
// - Session = jeton HMAC-SHA256 dans un cookie HttpOnly / Secure / SameSite=Strict.
// - Chaque requête protégée recharge l'utilisateur en base (compte actif, rôle courant).
// - Variable d'environnement obligatoire : AUTH_SECRET (≥ 32 caractères).
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { sql } from './_db.js';

export type Role = 'ADMIN' | 'AGENT_IMPORT' | 'AGENT_EXPORT' | 'COMPTABILITE' | 'CLIENT_EXPORT';

export const ALL_ROLES: Role[] = ['ADMIN', 'AGENT_IMPORT', 'AGENT_EXPORT', 'COMPTABILITE', 'CLIENT_EXPORT'];
export const STAFF_ROLES: Role[] = ['ADMIN', 'AGENT_IMPORT', 'AGENT_EXPORT', 'COMPTABILITE'];
export const ADMIN_ONLY: Role[] = ['ADMIN'];
export const FINANCE_ADMIN_ROLES: Role[] = ['ADMIN', 'COMPTABILITE'];

export interface SessionUser {
  id: number;
  nomComplet: string;
  email: string;
  role: Role;
}

const SESSION_COOKIE = 'bocs_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 h
const MIN_SECRET_LENGTH = 32;
const SCRYPT_KEYLEN = 64;
const HASH_PREFIX = 'scrypt$';

// ─── Mots de passe ─────────────────────────────────────────────────────────

const scryptAsync = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => (err ? reject(err) : resolve(key)));
  });

export const isPasswordHash = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith(HASH_PREFIX);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `${HASH_PREFIX}${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Vérifie un mot de passe ; accepte l'ancien format en clair (migration paresseuse). */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  if (!isPasswordHash(stored)) {
    const a = Buffer.from(password);
    const b = Buffer.from(stored);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const [, saltB64, keyB64] = stored.split('$');
  if (!saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password: unknown): string | null {
  if (typeof password !== 'string' || password.trim().length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  return null;
}

// ─── Jetons de session ─────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || '';
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET manquant ou trop court (≥ ${MIN_SECRET_LENGTH} caractères requis).`);
  }
  return secret;
}

const sign = (payload: string): string =>
  createHmac('sha256', getSecret()).update(payload).digest('base64url');

function createToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string): number | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof data.uid !== 'number' || typeof data.exp !== 'number') return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data.uid;
  } catch {
    return null;
  }
}

function parseCookies(req: any): Record<string, string> {
  const header: string = req.headers?.cookie || '';
  return Object.fromEntries(
    header.split(';')
      .map(part => part.trim().split('='))
      .filter(([k, v]) => k && v !== undefined)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])
  );
}

const isProduction = () => process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

function cookieAttributes(maxAge: number): string {
  const secure = isProduction() ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function setSessionCookie(res: any, userId: number): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${createToken(userId)}; ${cookieAttributes(SESSION_TTL_SECONDS)}`);
}

export function clearSessionCookie(res: any): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttributes(0)}`);
}

// ─── Contrôle d'accès ──────────────────────────────────────────────────────

/** Rejette les requêtes de mutation émises depuis une autre origine (défense CSRF en profondeur). */
function isCrossOriginMutation(req: any): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return false;
  const origin: string | undefined = req.headers?.origin;
  if (!origin) return false;
  const host: string | undefined = req.headers?.['x-forwarded-host'] || req.headers?.host;
  try {
    return !host || new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/** Lit la session courante et recharge l'utilisateur en base ; null si absente/invalide. */
export async function getSessionUser(req: any): Promise<SessionUser | null> {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const userId = readToken(token);
  if (userId === null) return null;
  const rows = await sql`
    SELECT id, nom_complet as "nomComplet", email, role, est_actif as "estActif"
    FROM users WHERE id = ${userId} LIMIT 1;
  `;
  const user = rows[0];
  if (!user || !user.estActif) return null;
  return { id: Number(user.id), nomComplet: user.nomComplet, email: user.email, role: user.role };
}

/**
 * Exige une session valide (et un rôle autorisé si `roles` est fourni).
 * Envoie 401/403 et renvoie null en cas de refus.
 */
export async function requireAuth(req: any, res: any, roles: Role[] = ALL_ROLES): Promise<SessionUser | null> {
  try {
    if (isCrossOriginMutation(req)) {
      res.status(403).json({ success: false, error: 'Origine de la requête refusée.' });
      return null;
    }
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentification requise.' });
      return null;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ success: false, error: 'Accès refusé pour votre profil.' });
      return null;
    }
    return user;
  } catch (error) {
    sendServerError(res, error, 'auth');
    return null;
  }
}

// ─── Utilitaires ───────────────────────────────────────────────────────────

/** Journalise l'erreur côté serveur et renvoie un message générique (pas de fuite SQL). */
export function sendServerError(res: any, error: unknown, context: string): void {
  console.error(`[api:${context}]`, error);
  res.status(500).json({ success: false, error: 'Erreur interne du serveur.' });
}

export function clientIp(req: any): string {
  const forwarded: string = req.headers?.['x-forwarded-for'] || '';
  return forwarded.split(',')[0].trim() || req.socket?.remoteAddress || 'inconnue';
}

/** Écrit une entrée d'audit au nom de l'utilisateur authentifié (best effort). */
export async function writeAudit(req: any, user: { nomComplet: string; role: string }, action: string, entite: string, details: string): Promise<void> {
  try {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await sql`
      INSERT INTO audit_logs (id, utilisateur_nom, role, action, entite, details, date_action, ip)
      VALUES (${Date.now() * 1000 + Math.floor(Math.random() * 1000)}, ${user.nomComplet}, ${user.role}, ${action}, ${entite}, ${details}, ${now}, ${clientIp(req)});
    `;
  } catch (error) {
    console.error('[api:audit] écriture impossible', error);
  }
}
