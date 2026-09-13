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

  console.log("Cleaning up invoice_items with quantite <= 0 or montant_ht <= 0...");
  const res = await sql`DELETE FROM invoice_items WHERE quantite <= 0 OR montant_ht <= 0;`;
  console.log("Cleanup finished.");

  const items = await sql`SELECT count(*)::int as count FROM invoice_items;`;
  console.log("Remaining valid invoice items:", items[0].count);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
