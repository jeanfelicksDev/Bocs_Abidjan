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

const dbUrl = process.env.BOCS_DATABASE_URL 
  || process.env.POSTGRES_URL 
  || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("Aucune URL de base de données trouvée dans .env.local");
  process.exit(1);
}

const sql = neon(dbUrl);

async function purge() {
  console.log("Connexion à Neon PostgreSQL...");
  console.log("Suppression des escales et de leurs données associées...");
  
  try {
    await sql`DELETE FROM payments;`;
    console.log("✓ Règlements supprimés (payments)");

    await sql`DELETE FROM credit_note_items;`;
    console.log("✓ Lignes d'avoirs supprimées (credit_note_items)");

    await sql`DELETE FROM credit_notes;`;
    console.log("✓ Avoirs supprimés (credit_notes)");

    await sql`DELETE FROM invoice_items;`;
    console.log("✓ Lignes de factures supprimées (invoice_items)");

    await sql`DELETE FROM invoices;`;
    console.log("✓ Factures supprimées (invoices)");

    await sql`DELETE FROM containers;`;
    console.log("✓ Conteneurs supprimés (containers)");

    await sql`DELETE FROM bls;`;
    console.log("✓ Connaissements supprimés (bls)");

    await sql`DELETE FROM escales;`;
    console.log("✓ Escales supprimées (escales)");

    const [escalesCount] = await sql`SELECT COUNT(*)::int as count FROM escales;`;
    const [blsCount] = await sql`SELECT COUNT(*)::int as count FROM bls;`;
    const [invCount] = await sql`SELECT COUNT(*)::int as count FROM invoices;`;

    console.log(`\nBilan de la base :`);
    console.log(`- Escales restantes : ${escalesCount.count}`);
    console.log(`- Connaissements (BLs) restants : ${blsCount.count}`);
    console.log(`- Factures restantes : ${invCount.count}`);
    console.log("\nPurge des escales et de leurs données réussie !");
  } catch (err) {
    console.error("Erreur pendant la purge:", err);
  }
}

purge();
