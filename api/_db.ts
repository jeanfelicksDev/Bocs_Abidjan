import { neon } from '@neondatabase/serverless';

let sqlFunc: any;

try {
  let dbUrl: string | null = null;

  if (typeof process !== 'undefined' && process.env) {
    // 1. Priorité absolue aux variables de la base active BOCS / Neon
    dbUrl = process.env.BOCS_DATABASE_URL
      || process.env.BOCS_POSTGRES_URL
      || process.env.BOCS_DATABASE_URL_UNPOOLED
      || process.env.NEON_DATABASE_URL
      || process.env.NEON_POSTGRES_URL
      || process.env.POSTGRES_URL
      || process.env.DATABASE_URL
      || null;

    // 2. Recherche automatique de toute variable contenant une URL postgresql
    if (!dbUrl) {
      for (const [key, val] of Object.entries(process.env)) {
        if (typeof val === 'string' && (val.startsWith('postgres://') || val.startsWith('postgresql://'))) {
          dbUrl = val;
          break;
        }
      }
    }
  }

  if (dbUrl) {
    sqlFunc = neon(dbUrl);
  } else {
    sqlFunc = (async () => []) as any;
  }
} catch (e) {
  console.error("Database connection error in api/db.ts:", e);
  sqlFunc = (async () => []) as any;
}

export const sql = sqlFunc;


