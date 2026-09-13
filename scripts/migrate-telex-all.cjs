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

async function main() {
  if (!dbUrl) {
    console.error("No database URL found in .env.local");
    return;
  }
  const sql = neon(dbUrl);

  console.log("Seeding Telex rubriques for all types...");
  await sql`
    INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES 
      ('301', '3', 'CONTENEUR', 'Frais de message Telex', 'Frais de libération par télex', 'TLX-FEE', true, 25000, 'BL'),
      ('302', '3', 'VRAC', 'Frais de message Telex', 'Frais de libération par télex', 'TLX-FEE', true, 25000, 'BL'),
      ('303', '3', 'RORO', 'Frais de message Telex', 'Frais de libération par télex', 'TLX-FEE', true, 25000, 'BL'),
      ('304', '3', 'CONVENTIONNEL', 'Frais de message Telex', 'Frais de libération par télex', 'TLX-FEE', true, 25000, 'BL')
    ON CONFLICT (id) DO NOTHING;
  `;

  const telexRubriques = await sql`SELECT * FROM rubrique_configs WHERE invoice_type_id = '3';`;
  console.log("Telex rubriques now in database:", telexRubriques);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
