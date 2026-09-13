const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
}

const dbUrl = process.env.POSTGRES_URL 
  || process.env.DATABASE_URL 
  || process.env.BOCS_POSTGRES_URL
  || process.env.NEON_DATABASE_URL;

console.log("Using Database URL:", dbUrl ? dbUrl.replace(/:[^:@]+@/, ':***@') : 'NONE');

async function main() {
  if (!dbUrl) {
    console.error("No database URL found in .env.local");
    return;
  }
  const sql = neon(dbUrl);

  console.log("Checking rubrique_configs before deletion...");
  const before = await sql`SELECT id, invoice_type_id, category, name, code FROM rubrique_configs WHERE invoice_type_id = '2';`;
  console.log("Current rubriques for Echange:", before);

  console.log("Deleting 'Frais d''échange BL (SOC)' / id 205...");
  const deleteRes = await sql`
    DELETE FROM rubrique_configs 
    WHERE id = '205' 
       OR (category = 'CONTENEUR_SOC' AND (name ILIKE '%échange%' OR code = 'ECH-SOC'));
  `;
  console.log("Delete result completed.");

  const after = await sql`SELECT id, invoice_type_id, category, name, code FROM rubrique_configs WHERE invoice_type_id = '2';`;
  console.log("After deletion:", after);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
