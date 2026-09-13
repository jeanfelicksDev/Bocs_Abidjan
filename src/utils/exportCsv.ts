import { Invoice, Payment, BL, DraftExport } from '../types';

/** Encode une valeur pour CSV (échappe les guillemets, gère les virgules) */
function csvCell(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Construit une ligne CSV depuis un tableau de valeurs */
function csvRow(values: (string | number | undefined | null)[]): string {
  return values.map(csvCell).join(',');
}

/** Déclenche le téléchargement d'un fichier CSV dans le navigateur */
function downloadCsv(content: string, filename: string) {
  const BOM = '\uFEFF'; // UTF-8 BOM pour Excel
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Formate une date ISO en format lisible */
function fmtDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
}

// ─── EXPORT FACTURES ─────────────────────────────────────────────────────────

export function exportInvoicesCsv(invoices: Invoice[], filename = 'factures_bocs.csv') {
  const header = csvRow([
    'N° Facture', 'Client', 'N° BL', 'Type', 'Date Facture', 'Date Échéance',
    'Montant HT (FCFA)', 'TVA (FCFA)', 'Montant TTC (FCFA)', 'Solde Dû (FCFA)',
    'Statut Paiement', 'Statut Facture', 'Créé par',
  ]);

  const rows = invoices.map(inv => csvRow([
    inv.numeroFacture,
    inv.clientNom,
    inv.numeroBL || '',
    inv.typeFacture?.replace(/_/g, ' ') || '',
    fmtDate(inv.dateFacture),
    fmtDate(inv.dateEcheance),
    inv.montantHtFcfa,
    inv.tvaFcfa,
    inv.montantTtcFcfa,
    inv.soldeDuFcfa,
    inv.statutPaiement,
    inv.statutFacture || '',
    inv.createdBy || '',
  ]));

  downloadCsv([header, ...rows].join('\n'), filename);
}

// ─── EXPORT RÈGLEMENTS ───────────────────────────────────────────────────────

export function exportPaymentsCsv(payments: Payment[], filename = 'reglements_bocs.csv') {
  const header = csvRow([
    'N° Référence', 'N° Facture', 'Date Paiement', 'Mode Paiement',
    'Montant (FCFA)', 'Saisi par', 'Note',
  ]);

  const rows = payments.map(p => csvRow([
    p.referenceTransaction,
    p.numeroFacture,
    fmtDate(p.datePaiement),
    p.modePaiement,
    p.montantFcfa,
    p.saisiPar,
    p.note || '',
  ]));

  downloadCsv([header, ...rows].join('\n'), filename);
}

// ─── EXPORT BLs ──────────────────────────────────────────────────────────────

export function exportBlsCsv(bls: BL[], filename = 'bls_bocs.csv') {
  const header = csvRow([
    'N° BL', 'Type Opération', 'Consignee', 'Shipper', 'Notify',
    'Port Chargement', 'Port Déchargement', 'Nb Colis', 'Poids Brut (kg)',
    'Volume (m³)', 'Nb Conteneurs', 'Statut Import',
  ]);

  const rows = bls.map(bl => csvRow([
    bl.numeroBL,
    bl.typeOperation,
    bl.consigneeNom,
    bl.shipperNom,
    bl.notifyNom,
    bl.portChargementCode,
    bl.portDechargementCode,
    bl.nombreColis,
    bl.poidsBrutKg,
    bl.volumeM3,
    (bl.conteneurs || []).length,
    bl.statutImport || 'EN_ATTENTE',
  ]));

  downloadCsv([header, ...rows].join('\n'), filename);
}

// ─── EXPORT MANIFESTE EXPORT ────────────────────────────────────────────────
export function exportExportManifestCsv(drafts: DraftExport[], escaleName = 'escale_export') {
  const header = csvRow([
    'N° BL', 'Booking Ref', 'Navire', 'Voyage', 'Chargeur', 'Destinataire', 'Notify',
    'Port Chargement', 'Port Déchargement', 'Description Marchandises', 'Code SH', 'Nombre Colis', 'Emballage',
    'Poids Brut (kg)', 'Volume (m³)', 'N° Conteneurs & Plombs', 'Statut'
  ]);
  const rows = drafts.map(d => csvRow([
    d.numeroBlGenere || d.numeroDraft,
    d.bookingRef || '',
    d.navireNom || '',
    d.numeroVoyage || '',
    d.shipperInfo.nom,
    d.consigneeInfo.nom,
    d.notifyInfo.nom || '',
    d.portChargementCode || 'CIABJ',
    d.portDechargementNom || d.portDechargementCode || '',
    d.marchandisesInfo.description,
    d.marchandisesInfo.hsCode || '',
    d.marchandisesInfo.nombreColis,
    d.marchandisesInfo.typeEmballage,
    d.marchandisesInfo.poidsBrutKg,
    d.marchandisesInfo.volumeM3,
    (d.conteneursInfo || []).map(c => `${c.numeroConteneur} (${c.typeConteneur})`).join(' ; '),
    d.statut
  ]));
  downloadCsv([header, ...rows].join('\n'), `manifeste_export_${escaleName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`);
}

