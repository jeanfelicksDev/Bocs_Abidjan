import { neon } from '@neondatabase/serverless';

// Liste explicite des variables acceptées (plus de balayage de tout process.env).
const DB_URL_ENV_KEYS = [
  'BOCS_DATABASE_URL',
  'BOCS_POSTGRES_URL',
  'BOCS_DATABASE_URL_UNPOOLED',
  'NEON_DATABASE_URL',
  'NEON_POSTGRES_URL',
  'POSTGRES_URL',
  'DATABASE_URL'
];

const dbUrl = DB_URL_ENV_KEYS.map(key => process.env[key]).find(Boolean) || null;

// Échec explicite si la base n'est pas configurée (au lieu de renvoyer silencieusement des listes vides).
const missingDatabase = (async () => {
  throw new Error(`Base de données non configurée : définir l'une des variables ${DB_URL_ENV_KEYS.join(', ')}.`);
}) as any;

export const sql: any = dbUrl ? neon(dbUrl) : missingDatabase;
