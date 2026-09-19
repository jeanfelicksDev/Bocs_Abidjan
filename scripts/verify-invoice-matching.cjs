// VÉRIFICATION : exécute la VRAIE logique de src/utils/invoiceMatching.ts (bundlée via
// esbuild) sur les données réelles de la base, afin de prouver la correction du doublon
// entre les cartes « Détention Import » / « Détention Export » et l'unicité des numéros.
// Usage : node scripts/verify-invoice-matching.cjs   (lecture seule — aucune écriture)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { neon } = require('@neondatabase/serverless');

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
  || process.env.BOCS_POSTGRES_URL
  || process.env.NEON_DATABASE_URL
  || process.env.POSTGRES_URL
  || process.env.DATABASE_URL;

/** Bundle le module TS réel et le charge en CommonJS (aucune copie de la logique). */
function loadRealMatcher() {
  const esbuild = require('esbuild');
  const entry = path.join(__dirname, '..', 'src', 'utils', 'invoiceMatching.ts');
  const outfile = path.join(os.tmpdir(), `bocs-invoiceMatching-${Date.now()}.cjs`);
  esbuild.buildSync({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    logLevel: 'silent'
  });
  return { mod: require(outfile), outfile };
}

let passed = 0;
let failed = 0;
const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  OK    ${label}`);
  } else {
    failed += 1;
    console.log(`  ECHEC ${label}${detail ? ` — ${detail}` : ''}`);
  }
};
async function main() {
  const { mod, outfile } = loadRealMatcher();
  const {
    getInvoiceTypePrefix,
    getInvoiceTypeDiscriminant,
    invoiceMatchesType,
    findInvoiceForType,
    resolveUniqueInvoiceNumber
  } = mod;
  console.log(`Module réel chargé : ${outfile}\n`);

  // ─────────────────────────────────────────────────────────────
  // A. Cas unitaires construits (logique pure, sans base)
  // ─────────────────────────────────────────────────────────────
  console.log('=== A. Cas unitaires ===');
  const cfgImport = { id: '10', name: 'Détention Import', description: '' };
  const cfgExport = { id: '11', name: 'Détention Export', description: '' };
  const cfgSurestarie = { id: '5', name: 'Surestaries', description: '' };
  const allDet = [cfgImport, cfgExport, cfgSurestarie];

  check('Préfixe « Détention Import » = DET', getInvoiceTypePrefix(cfgImport.name) === 'DET');
  check('Préfixe « Détention Export » = DET (ambiguïté attendue)',
    getInvoiceTypePrefix(cfgExport.name) === 'DET');
  check('Discriminant Import = IMP', getInvoiceTypeDiscriminant(cfgImport.name) === 'IMP');
  check('Discriminant Export = EXP', getInvoiceTypeDiscriminant(cfgExport.name) === 'EXP');

  // Défaut historique : la proforma Import ne doit plus être captée par Export.
  const profImport = {
    id: 1,
    clientNom: 'X',
    typeFacture: 'Détention Import',
    numeroFacture: 'PROF-DET-IMP-BL01-202609',
    dateFacture: '2026-09-19',
    dateEcheance: '2026-10-04',
    devise: 'FCFA',
    tauxChangeUsd: 600,
    montantHtFcfa: 99000,
    tvaFcfa: 17820,
    montantTtcFcfa: 116820,
    soldeDuFcfa: 116820,
    statutPaiement: 'NON_PAYE',
    statutFacture: 'BROUILLON',
    invoiceTypeId: '10',
    lignes: []
  };
  check('Proforma Import reconnue par « Détention Import »',
    invoiceMatchesType(profImport, cfgImport, allDet));
  check('Proforma Import NON reconnue par « Détention Export » (doublon corrigé)',
    !invoiceMatchesType(profImport, cfgExport, allDet));

  // Facture ancienne sans type rattaché : le repli doit rester cantonné.
  const legacyDet = {
    ...profImport,
    invoiceTypeId: undefined,
    numeroFacture: 'DET23409-BOCS001',
    typeFacture: 'PROFORMA_IMPORT'
  };
  check('Legacy DET : repli refusé car préfixe ambigu (Import/Export)',
    !invoiceMatchesType(legacyDet, cfgImport, allDet) &&
    !invoiceMatchesType(legacyDet, cfgExport, allDet));

  const legacySur = { ...legacyDet, numeroFacture: 'SUR23409-BOCS001' };
  check('Legacy SUR : repli accepté (préfixe non ambigu)',
    !invoiceMatchesType(legacySur, cfgImport, allDet) &&
    invoiceMatchesType(legacySur, cfgSurestarie, allDet));

  const prefixeNoie = { ...legacyDet, numeroFacture: 'CAU1DET9-BOCS001' };
  check('Préfixe non délimité refusé (« 1DET9 » n\'est pas le jeton DET)',
    !invoiceMatchesType(prefixeNoie, cfgSurestarie, allDet));

  // Facture typée : le préfixe d'un AUTRE type ne doit pas la capturer.
  check('Facture typée non capturée par un autre type',
    !invoiceMatchesType(profImport, cfgSurestarie, allDet));

  // Repli sur libellé exact : factures legacy dont le type n'est pas rattaché.
  const legacyLabel = { ...profImport, invoiceTypeId: undefined, typeFacture: 'Détention Import' };
  check('Repli sur libellé exact quand le type n\'est pas rattaché',
    invoiceMatchesType(legacyLabel, cfgImport, allDet) &&
    !invoiceMatchesType(legacyLabel, cfgExport, allDet));
// ─────────────────────────────────────────────────────────────
  // B. Invariant anti-doublon sur les données réelles
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== B. Invariant anti-doublon sur les données réelles ===');
  if (!dbUrl) {
    console.log('  (base indisponible : invariant non vérifié)');
  } else {
    const sql = neon(dbUrl);
    const types = (await sql`SELECT id, name, description FROM invoice_type_configs ORDER BY id;`)
      .map(t => ({ id: String(t.id), name: String(t.name || ''), description: String(t.description || '') }));

    const rawInvoices = await sql`
      SELECT id, bl_id, numero_bl, invoice_type_id, type_facture, numero_facture,
             statut_facture, statut_paiement, montant_ttc, solde_du
      FROM invoices ORDER BY id;
    `;
    const invoices = rawInvoices.map(r => ({
      id: Number(r.id),
      blId: r.bl_id === null ? undefined : Number(r.bl_id),
      numeroBL: r.numero_bl || undefined,
      invoiceTypeId: r.invoice_type_id === null ? undefined : String(r.invoice_type_id),
      typeFacture: r.type_facture,
      numeroFacture: r.numero_facture,
      statutFacture: r.statut_facture || 'BROUILLON',
      statutPaiement: r.statut_paiement,
      soldeDuFcfa: Number(r.solde_du) || 0,
      montantTtcFcfa: Number(r.montant_ttc) || 0
    }));

    const blKeys = [...new Set(invoices.map(i => i.numeroBL).filter(Boolean))];
    let doublonsCartes = 0;
    let blAvecDetentionDouble = 0;

    for (const numeroBL of blKeys) {
      const blInvoices = invoices.filter(i => i.numeroBL === numeroBL);

      // Cartes réellement rendues : un type s'affiche dès qu'une facture lui est rattachée.
      const cartes = types
        .map(t => ({ type: t, inv: findInvoiceForType(blInvoices, t, types) }))
        .filter(c => c.inv);

      // Invariant : deux cartes ne peuvent pas afficher la même facture.
      const vus = new Map();
      for (const c of cartes) {
        const key = c.inv.numeroFacture;
        if (vus.has(key)) {
          doublonsCartes += 1;
          console.log(`  !! BL ${numeroBL} : le n° ${key} est affiché par « ${vus.get(key)} » ET « ${c.type.name} »`);
        } else {
          vus.set(key, c.type.name);
        }
      }

      const detCartes = cartes.filter(c => /tention/i.test(c.type.name));
      if (detCartes.length > 1) {
        blAvecDetentionDouble += 1;
        console.log(`  !! BL ${numeroBL} : ${detCartes.length} cartes détention (${detCartes.map(d => d.type.name).join(', ')})`);
      }

      if (detCartes.length > 0) {
        console.log(`  BL ${numeroBL} → détention : ${detCartes.map(d => `${d.type.name}=${d.inv.numeroFacture}`).join(' | ')}`);
      }
    }

    check(`Aucune facture affichée par deux cartes (${blKeys.length} BL analysés)`, doublonsCartes === 0);
    check('Aucun BL ne rend deux cartes de détention', blAvecDetentionDouble === 0);

    // Non-régression sur les deux BL du constat initial.
    for (const numeroBL of ['ANRABJ26614101', 'ANRABJ26614107']) {
      const blInvoices = invoices.filter(i => i.numeroBL === numeroBL);
      if (blInvoices.length === 0) continue;
      const rendues = types
        .map(t => ({ type: t, inv: findInvoiceForType(blInvoices, t, types) }))
        .filter(c => c.inv)
        .map(c => c.type.name);
      check(`BL ${numeroBL} : « Détention Import » rendue`, rendues.includes('Détention Import'));
      check(`BL ${numeroBL} : « Détention Export » NON rendue`, !rendues.includes('Détention Export'),
        `rendues = ${rendues.join(', ')}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // C. Unicité des numéros à l'émission
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== C. Unicité des numéros à l\'émission ===');
  const existing = [{ id: 1, numeroFacture: 'PROF-DET-IMP-BL01-202609' }];
  const base = 'PROF-DET-IMP-BL01-202609';
  const n1 = resolveUniqueInvoiceNumber(base, existing);
  const n2 = resolveUniqueInvoiceNumber(base, existing);
  const n3 = resolveUniqueInvoiceNumber(base, existing);
  check(`Anti-collision : ${n1} / ${n2} / ${n3}`,
    n1 === 'PROF-DET-IMP-BL01-202609-02' &&
    n2 === 'PROF-DET-IMP-BL01-202609-03' &&
    n3 === 'PROF-DET-IMP-BL01-202609-04');
  check('Trois émissions successives donnent trois numéros distincts',
    new Set([n1, n2, n3]).size === 3);

  console.log(`\n=== Résultat : ${passed} OK, ${failed} échec(s) ===`);
  try { fs.unlinkSync(outfile); } catch { /* ignore */ }
  if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('Erreur :', err);
  process.exit(1);
});