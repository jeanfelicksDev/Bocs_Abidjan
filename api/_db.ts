import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// ── Driver Neon serverless : le Pool utilise des WebSockets ─────────────────
// Sous Node.js (< 22) il faut fournir l'implémentation `ws`, sinon
// l'adaptateur ne peut pas se connecter (Node 22+ expose un WebSocket global).
neonConfig.webSocketConstructor = ws as any;

// ── Résolution de la chaîne de connexion ────────────────────────────────────
// Mêmes priorités que les scripts BOCS (.env.local / variables Vercel) :
// base active BOCS / Neon d'abord, puis variables génériques.
function resolveDatabaseUrl(): string {
  if (typeof process !== 'undefined' && process.env) {
    const direct = process.env.BOCS_DATABASE_URL
      || process.env.BOCS_POSTGRES_URL
      || process.env.BOCS_DATABASE_URL_UNPOOLED
      || process.env.NEON_DATABASE_URL
      || process.env.NEON_POSTGRES_URL
      || process.env.POSTGRES_URL
      || process.env.DATABASE_URL;

    if (direct) return direct;

    // Recherche automatique de toute variable contenant une URL postgresql
    for (const value of Object.values(process.env)) {
      if (typeof value === 'string' && (value.startsWith('postgres://') || value.startsWith('postgresql://'))) {
        return value;
      }
    }
  }
  return '';
}

const connectionString = resolveDatabaseUrl();
if (!connectionString) {
  console.warn('[api/_db] Aucune URL PostgreSQL trouvée dans les variables d\'environnement.');
}

// Prisma ORM 7 exige un driver adapter explicite (pas de moteur embarqué).
// `DB_DRIVER=pg` : PostgreSQL classique (serveur installé dans l'entreprise, TCP).
// Par défaut : Neon serverless (déploiement Vercel).
export const dbDriver = process.env.DB_DRIVER === 'pg' ? 'pg' : 'neon';
const fallbackUrl = 'postgresql://postgres:postgres@localhost:5432/postgres';
const adapter =
  dbDriver === 'pg'
    ? new PrismaPg({ connectionString: connectionString || fallbackUrl })
    : new PrismaNeon({ connectionString: connectionString || fallbackUrl });

// ── Accès SQL brut (endpoints de maintenance : /api/init-db, /api/purge-demo) ─
// Conservé pour les migrations idempotentes et purges ciblées écrites en SQL
// paramétré ; tous les endpoints métier passent par Prisma ci-dessous.
export const sql = connectionString && dbDriver === 'neon'
  ? neon(connectionString)
  : ((async () => []) as any);

// Prevent multiple instances of Prisma Client in development
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    adapter,
    // Le journal de chaque requête SQL n'est utile qu'en développement.
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

