import crypto from 'crypto';
import { prisma, databaseUrl } from './_db.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Authentification et droits côté serveur
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Avant ce module, l'API ne vérifiait aucune identité : toute personne qui
 * connaissait l'adresse pouvait lire et modifier les données. Désormais :
 *
 *  • la connexion (`POST /api/users {action:'login'}`) dépose un cookie de
 *    session signé (HMAC-SHA256), HttpOnly, SameSite=Lax, Secure en HTTPS ;
 *  • chaque route déclare, par méthode, qui peut l'appeler (`protect`) ;
 *  • le compte est relu en base à chaque requête (cache 30 s) : un compte
 *    désactivé ou dont le rôle change perd ses droits presque aussitôt ;
 *  • un client export ne reçoit que ses propres données (filtrage `clientView`).
 *
 * Les rôles autorisés reprennent la matrice d'habilitations par défaut
 * (src/utils/permissions.ts). Une personnalisation de la matrice faite dans
 * l'interface ne change que l'affichage : le serveur applique ces règles-ci.
 */

export type Role = 'ADMIN' | 'AGENT_IMPORT' | 'AGENT_EXPORT' | 'COMPTABILITE' | 'CLIENT_EXPORT';

export interface SessionUser {
  id: number;
  role: Role;
  email: string;
  nomComplet: string;
  nomSociete: string | null;
}

export const STAFF: Role[] = ['ADMIN', 'AGENT_IMPORT', 'AGENT_EXPORT', 'COMPTABILITE'];
export const isClient = (user: SessionUser | null | undefined) => user?.role === 'CLIENT_EXPORT';

const COOKIE = 'bocs_session';
const SESSION_HOURS = 12;

// Secret de signature : SESSION_SECRET, sinon dérivé de la chaîne de connexion à la
// base (elle-même secrète et propre à chaque installation). Changer le secret
// déconnecte tout le monde.
const SECRET = crypto
  .createHash('sha256')
  .update(process.env.SESSION_SECRET || `bocs-session:${databaseUrl || 'dev'}`)
  .digest();
if (!process.env.SESSION_SECRET) {
  console.warn('[api/_auth] SESSION_SECRET absent : secret de session dérivé de la chaîne de connexion.');
}

const b64url = (buf: Buffer) => buf.toString('base64url');
const sign = (payload: string) => b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());

const createToken = (userId: number): string => {
  const payload = b64url(Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_HOURS * 3600_000 })));
  return `${payload}.${sign(payload)}`;
};

const readToken = (token: string): number | null => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof uid === 'number' && typeof exp === 'number' && exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
};

const readCookie = (req: any, name: string): string | null => {
  const header = String(req.headers?.cookie || '');
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
};

const isHttps = (req: any) =>
  String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || !!req.socket?.encrypted;

const cookieAttributes = (req: any, maxAge: number) =>
  ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`, ...(isHttps(req) ? ['Secure'] : [])].join('; ');

export const setSessionCookie = (req: any, res: any, userId: number) =>
  res.setHeader('Set-Cookie', `${COOKIE}=${createToken(userId)}; ${cookieAttributes(req, SESSION_HOURS * 3600)}`);

export const clearSessionCookie = (req: any, res: any) =>
  res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieAttributes(req, 0)}`);

// ── Compte de la session (relu en base, cache court) ────────────────────────
const cache = new Map<number, { user: SessionUser | null; at: number }>();
const CACHE_MS = 30_000;

export const forgetCachedUser = (userId: number) => cache.delete(userId);

const loadUser = async (userId: number): Promise<SessionUser | null> => {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.user;
  const row = await prisma.users.findUnique({
    where: { id: BigInt(userId) },
    select: { id: true, role: true, email: true, nom_complet: true, nom_societe: true, est_actif: true, deleted_at: true }
  });
  const user =
    row && row.est_actif && !row.deleted_at
      ? {
          id: Number(row.id),
          role: row.role as Role,
          email: row.email,
          nomComplet: row.nom_complet,
          nomSociete: row.nom_societe
        }
      : null;
  cache.set(userId, { user, at: Date.now() });
  return user;
};

export const getSessionUser = async (req: any): Promise<SessionUser | null> => {
  const token = readCookie(req, COOKIE);
  const userId = token ? readToken(token) : null;
  return userId === null ? null : loadUser(userId);
};

// ── Limitation des essais de connexion ──────────────────────────────────────
const failures = new Map<string, { count: number; since: number }>();
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60_000;

const clientIp = (req: any) =>
  String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';

/** Nombre d'échecs récents pour cette adresse IP et ce compte ; `true` si bloqué. */
export const loginBlocked = (req: any, email: string): boolean => {
  const entry = failures.get(`${clientIp(req)}|${email.toLowerCase()}`);
  return !!entry && Date.now() - entry.since < WINDOW_MS && entry.count >= MAX_FAILURES;
};

export const recordLoginResult = (req: any, email: string, success: boolean) => {
  const key = `${clientIp(req)}|${email.toLowerCase()}`;
  if (success) return void failures.delete(key);
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.since >= WINDOW_MS) failures.set(key, { count: 1, since: Date.now() });
  else entry.count += 1;
};

// ── Portail client exposé sur Internet ──────────────────────────────────────
/**
 * Le proxy du portail public (deploy/portail/) ajoute l'en-tête `X-BOCS-Portail: client`
 * à chaque requête venue d'Internet, et le proxy interne le supprime. Sur le portail,
 * seuls les comptes client export sont acceptés : le personnel BOCS ne se connecte
 * que depuis le réseau de l'entreprise, même avec un mot de passe dérobé.
 */
export const viaClientPortal = (req: any) =>
  String(req.headers?.['x-bocs-portail'] || '').toLowerCase() === 'client';

export const PORTAL_STAFF_REFUSED = 'Accès réservé aux clients sur ce portail : le personnel BOCS se connecte depuis le réseau interne.';

// ── Garde des routes ────────────────────────────────────────────────────────
/** `public` : sans connexion · `user` : toute personne connectée · liste de rôles. */
export type Access = 'public' | 'user' | Role[];
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RouteRules {
  access: Partial<Record<Method, Access>>;
  /** Filtre une réponse destinée à un client export (ne garder que ses données). */
  clientView?: (body: any, user: SessionUser, req: any) => Promise<any> | any;
  /** Contrôle une écriture d'un client export ; renvoie un message d'erreur pour refuser. */
  clientWrite?: (req: any, user: SessionUser) => Promise<string | null> | string | null;
}

type Handler = (req: any, res: any) => unknown;

export function protect(rules: RouteRules, handler: Handler): Handler {
  return async (req: any, res: any) => {
    const method = String(req.method || 'GET').toUpperCase() as Method;
    // Méthode non déclarée : réservée au personnel (le gestionnaire répond 405 s'il ne la connaît pas).
    const access: Access = rules.access[method] ?? STAFF;
    const user = access === 'public' ? await getSessionUser(req).catch(() => null) : await getSessionUser(req);
    req.user = user;

    if (user && viaClientPortal(req) && !isClient(user)) {
      return res.status(403).json({ success: false, error: PORTAL_STAFF_REFUSED });
    }

    if (access !== 'public') {
      if (!user) return res.status(401).json({ success: false, error: 'Session expirée ou absente : reconnectez-vous.' });
      if (access !== 'user' && !access.includes(user.role)) {
        return res.status(403).json({ success: false, error: 'Action non autorisée pour votre profil.' });
      }
    }

    if (user && isClient(user)) {
      if (method !== 'GET' && rules.clientWrite) {
        const refused = await rules.clientWrite(req, user);
        if (refused) return res.status(403).json({ success: false, error: refused });
      }
      if (method === 'GET' && rules.clientView) {
        const json = res.json.bind(res);
        res.json = (body: any) => {
          if (res.statusCode >= 400 || !body || body.success === false) return json(body);
          return Promise.resolve(rules.clientView!(body, user, req)).then(json, (e: any) => {
            console.error('[api/_auth] filtrage client', e);
            res.statusCode = 500;
            return json({ success: false, error: 'Erreur de filtrage.' });
          });
        };
      }
    }
    return handler(req, res);
  };
}
