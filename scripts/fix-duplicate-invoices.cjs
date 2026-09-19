/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  RÉPARATION — Proformas dupliquées
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Contexte : l'émission de proforma juxtaposait `Date.now()` comme identifiant et
 * la numérotation était dérivée du seul couple (type, voyage). Trois émissions
 * successives sur le même BL — typiquement une Détention calculée par conteneur —
 * produisaient donc PLUSIEURS lignes STRICTEMENT identiques en base, partageant le
 * même `numero_facture` (violation de l'unicité DGI / FNE).
 *
 * Le code applicatif est corrigé (voir `src/utils/invoiceMatching.ts` :
 * `resolveUniqueInvoiceNumber`), mais les lignes déjà écrites subsistent. Ce script
 * les supprime.
 *
 * GARDE-FOUS — une ligne n'est supprimée que si TOUTES ces conditions sont réunies :
 *   • statut BROUILLON (jamais validée, donc jamais transmise à la DGI) ;
 *   • aucun paiement rattaché ;
 *   • aucun avoir ni facture d'origine rattachée ;
 *   • montants identiques à la ligne conservée ;
 *   • lignes de facturation identiques (désignation, quantité, PU, montant HT).
 * La plus ancienne ligne (plus petit id) est CONSERVÉE.
 *
 * Usage :
 *   node scripts/fix-duplicate-invoices.cjs            → simulation (aucune écriture)
 *   node scripts/fix-duplicate-invoices.cjs --apply    → exécution
 */
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const APPLY = process.argv.includes('--apply');

// Chargement de .env.local (même convention que les autres scripts du dossier)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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
  || process.env.BOCS_POSTGRES_URL
  || process.env.BOCS_DATABASE_URL_UNPOOLED
  || process.env.NEON_DATABASE_URL
  || process.env.NEON_POSTGRES_URL
  || process.env.POSTGRES_URL
  || process.env.DATABASE_URL;

/** Empreinte canonique des lignes d'une facture (pour prouver l'identité). */
const itemsSignature = items =>
  items
    .map(i => `${i.designation}|${Number(i.quantite)}|${Number(i.prix_unitaire)}|${Number(i.montant_ht)}`)
    .sort()
    .join('##');

async function main() {
  if (!dbUrl) {
    console.error('Aucune URL de base trouvée dans .env.local');
    process.exit(1);
  }
  const sql = neon(dbUrl);

  console.log(APPLY ? '*** MODE EXÉCUTION (--apply) ***' : '*** MODE SIMULATION (dry-run) ***');

  // Groupes de factures candidates : même BL, même type, même libellé et mêmes montants.
  const groups = await sql`
    SELECT numero_bl,
           COALESCE(invoice_type_id, '') AS invoice_type_id,
           COALESCE(type_facture, '')    AS type_facture,
           montant_ht,
           montant_ttc,
           count(*)::int AS occurrences
    FROM invoices
    GROUP BY numero_bl, COALESCE(invoice_type_id, ''), COALESCE(type_facture, ''),
             montant_ht, montant_ttc
    HAVING count(*) > 1
    ORDER BY occurrences DESC, numero_bl;
  `;

  if (groups.length === 0) {
    console.log('\nAucun groupe de factures dupliquées. Rien à faire.');
    return;
  }

  console.log(`\n${groups.length} groupe(s) de doublons détecté(s).\n`);

  const toDelete = [];

  for (const g of groups) {
    const rows = await sql`
      SELECT id, numero_facture, numero_bl, invoice_type_id, type_facture, statut_facture,
             statut_paiement, montant_ht, montant_ttc, solde_du, date_facture,
             facture_origine_id, avoir_id
      FROM invoices
      WHERE numero_bl = ${g.numero_bl}
        AND COALESCE(invoice_type_id, '') = ${g.invoice_type_id}
        AND COALESCE(type_facture, '')    = ${g.type_facture}
        AND montant_ht = ${g.montant_ht}
        AND montant_ttc = ${g.montant_ttc}
      ORDER BY id;
    `;

    const keeper = rows[0];
    const extras = rows.slice(1);

    console.log(`-- BL ${g.numero_bl} | ${g.type_facture} | TTC ${g.montant_ttc} | ${rows.length} occurrence(s)`);
    console.log(`   CONSERVEE : id=${keeper.id} n°=${keeper.numero_facture} (${keeper.statut_facture}/${keeper.statut_paiement})`);

    const keeperItems = await sql`
      SELECT designation, quantite, prix_unitaire, montant_ht
      FROM invoice_items WHERE invoice_id = ${keeper.id} ORDER BY id;
    `;
    const keeperSig = itemsSignature(keeperItems);

    for (const ex of extras) {
      const reasons = [];

      const pays = await sql`SELECT id FROM payments WHERE facture_id = ${ex.id} LIMIT 1;`;
      const exItems = await sql`
        SELECT designation, quantite, prix_unitaire, montant_ht
        FROM invoice_items WHERE invoice_id = ${ex.id} ORDER BY id;
      `;

      if (ex.statut_facture !== 'BROUILLON') reasons.push(`statut ${ex.statut_facture}`);
      if (pays.length > 0) reasons.push(`${pays.length} paiement(s)`);
      if (ex.facture_origine_id) reasons.push(`facture d'origine ${ex.facture_origine_id}`);
      if (ex.avoir_id) reasons.push(`avoir ${ex.avoir_id}`);
      if (itemsSignature(exItems) !== keeperSig) reasons.push('lignes différentes');

      if (reasons.length > 0) {
        console.log(`   [SKIP]    : id=${ex.id} n°=${ex.numero_facture} -> ${reasons.join(', ')}`);
        continue;
      }

      console.log(`   [SUPPR.]  : id=${ex.id} n°=${ex.numero_facture} (${ex.statut_facture}/${ex.statut_paiement}, ${exItems.length} ligne(s) identiques)`);
      toDelete.push({ id: ex.id, numero: ex.numero_facture, items: exItems.length });
    }
    console.log('');
  }

  if (toDelete.length === 0) {
    console.log('Aucune suppression autorisée par les garde-fous.');
    return;
  }

  console.log(`Bilan : ${toDelete.length} ligne(s) à supprimer (${toDelete.map(t => t.id).join(', ')})\n`);

  if (!APPLY) {
    console.log('Simulation terminée. Relancez avec --apply pour exécuter.');
    return;
  }

  // Suppression : items d'abord (aucune contrainte FK en base, on évite les orphelins).
  for (const target of toDelete) {
    const delItems = await sql`
      DELETE FROM invoice_items WHERE invoice_id = ${target.id} RETURNING id;
    `;
    const delInv = await sql`
      DELETE FROM invoices WHERE id = ${target.id} RETURNING id, numero_facture;
    `;
    console.log(`  OK id=${target.id} n°=${target.numero} supprimée (${delItems.length} ligne(s) + ${delInv.length} facture)`);
  }

  // Contrôle final : plus aucun numéro en doublon.
  const remaining = await sql`
    SELECT numero_facture, count(*)::int AS occurrences
    FROM invoices GROUP BY numero_facture HAVING count(*) > 1;
  `;
  console.log(`\nContrôle final : ${remaining.length} numéro(s) encore en doublon.`);
  if (remaining.length > 0) {
    console.table(remaining);
    process.exitCode = 1;
  } else {
    console.log('Unicité des numéros de facture rétablie.');
  }
}

main().catch(err => {
  console.error('Erreur :', err.message);
  process.exit(1);
});