import type { Invoice, InvoiceType, TaxeAdditionnelleConfig, TaxeAdditionnelleMode } from '../types';

/**
 * Taxe additionnelle exceptionnelle — assiette : MONTANT TTC.
 *
 * Règles BOCS :
 *  - La taxe est calculée sur le TTC de la facture (hors taxe additionnelle) puis
 *    ajoutée à celui-ci : TOTAL TTC du document = TTC de base + taxe.
 *  - La valeur (taux % ou montant fixe FCFA) est modifiable à tout moment par la
 *    comptabilité ; chaque facture conserve la valeur appliquée lors de son émission
 *    (auditabilité en cas de contrôle fiscal).
 *  - Le recalcul est idempotent : la base est mémorisée dans
 *    `montantTtcAvantTaxeFcfa`, donc régénérer ou modifier une facture ne cumule
 *    jamais la taxe plusieurs fois.
 */

export const TAXE_ADDITIONNELLE_STORAGE_KEY = 'bocs_taxe_additionnelle_config';

export const DEFAULT_TAXE_ADDITIONNELLE_CONFIG: TaxeAdditionnelleConfig = {
  id: 'taxe-additionnelle-exceptionnelle',
  libelle: 'Taxe additionnelle exceptionnelle',
  mode: 'POURCENTAGE',
  valeur: 0,
  estActif: false,
  estExceptionnelle: true,
  appliquerImport: true,
  appliquerExport: false,
  seuilMinTtcFcfa: 0,
  plafondFcfa: 0
};

/** Normalise une config partielle (localStorage / API) vers une config complète. */
export function normalizeTaxeAdditionnelleConfig(partial?: Partial<TaxeAdditionnelleConfig> | null): TaxeAdditionnelleConfig {
  const merged = { ...DEFAULT_TAXE_ADDITIONNELLE_CONFIG, ...(partial || {}) };
  return {
    ...merged,
    id: merged.id || DEFAULT_TAXE_ADDITIONNELLE_CONFIG.id,
    libelle: (merged.libelle || DEFAULT_TAXE_ADDITIONNELLE_CONFIG.libelle).trim(),
    mode: merged.mode === 'MONTANT_FIXE' ? 'MONTANT_FIXE' : 'POURCENTAGE',
    valeur: Math.max(0, Number(merged.valeur) || 0),
    estActif: merged.estActif === true,
    estExceptionnelle: merged.estExceptionnelle !== false,
    appliquerImport: merged.appliquerImport !== false,
    appliquerExport: merged.appliquerExport === true,
    seuilMinTtcFcfa: Math.max(0, Number(merged.seuilMinTtcFcfa) || 0),
    plafondFcfa: Math.max(0, Number(merged.plafondFcfa) || 0)
  };
}

export function loadTaxeAdditionnelleConfig(): TaxeAdditionnelleConfig {
  try {
    const saved = localStorage.getItem(TAXE_ADDITIONNELLE_STORAGE_KEY);
    if (saved) return normalizeTaxeAdditionnelleConfig(JSON.parse(saved));
  } catch (e) {
    console.error('Erreur chargement taxe additionnelle', e);
  }
  return { ...DEFAULT_TAXE_ADDITIONNELLE_CONFIG };
}

export function saveTaxeAdditionnelleConfig(config: TaxeAdditionnelleConfig): void {
  try {
    localStorage.setItem(TAXE_ADDITIONNELLE_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Erreur sauvegarde taxe additionnelle', e);
  }
}

/** La taxe s'applique-t-elle au type de facture considéré (périmètre Import / Export) ? */
export function isTaxeAdditionnelleApplicable(
  config: TaxeAdditionnelleConfig | undefined,
  typeFacture?: InvoiceType
): boolean {
  if (!config || !config.estActif || config.valeur <= 0) return false;
  if (!typeFacture) return true;
  const isExport = typeFacture.includes('EXPORT');
  return isExport ? config.appliquerExport : config.appliquerImport;
}
/** Somme des taxes additionnelles appliquées sur un lot de factures. */
export function sumTaxeAdditionnelle(invoices: Invoice[]): number {
  return invoices.reduce((acc, inv) => acc + (Number(inv.taxeAdditionnelleFcfa) || 0), 0);
}

export interface TaxeAdditionnelleApplication {
  /** true si la taxe est effectivement appliquée à cette facture. */
  appliquee: boolean;
  libelle: string;
  mode: TaxeAdditionnelleMode;
  /** Taux % ou montant FCFA retenu. */
  valeur: number;
  /** Assiette : TTC avant taxe additionnelle. */
  baseTtcFcfa: number;
  /** Montant de taxe calculé (0 si non appliquée). */
  montantFcfa: number;
  /** Motif de non-application (diagnostic / affichage). */
  motif?: string;
}

/**
 * Calcule la taxe additionnelle sur une assiette TTC.
 * @param config  Configuration courante (valeur mise à jour par la comptabilité)
 * @param baseTtcFcfa  Montant TTC servant d'assiette (TTC hors taxe additionnelle)
 * @param typeFacture  Type de facture, pour le périmètre Import / Export
 */
export function computeTaxeAdditionnelle(
  config: TaxeAdditionnelleConfig | undefined,
  baseTtcFcfa: number,
  typeFacture?: InvoiceType
): TaxeAdditionnelleApplication {
  const base = Math.max(0, Math.round(Number(baseTtcFcfa) || 0));
  const cfg = config ? normalizeTaxeAdditionnelleConfig(config) : DEFAULT_TAXE_ADDITIONNELLE_CONFIG;

  const nonAppliquee = (motif: string): TaxeAdditionnelleApplication => ({
    appliquee: false,
    libelle: cfg.libelle,
    mode: cfg.mode,
    valeur: cfg.valeur,
    baseTtcFcfa: base,
    montantFcfa: 0,
    motif
  });

  if (!cfg.estActif) return nonAppliquee('Taxe désactivée');
  if (cfg.valeur <= 0) return nonAppliquee('Valeur de taxe nulle');
  if (!isTaxeAdditionnelleApplicable(cfg, typeFacture)) {
    return nonAppliquee('Hors périmètre (type de facture)');
  }
  const seuil = cfg.seuilMinTtcFcfa || 0;
  if (seuil > 0 && base < seuil) {
    return nonAppliquee(`Assiette TTC inférieure au seuil de ${seuil.toLocaleString('fr-FR')} FCFA`);
  }

  // Calcul : pourcentage du TTC ou montant forfaitaire, puis application du plafond.
  let montant = cfg.mode === 'POURCENTAGE'
    ? Math.round(base * (cfg.valeur / 100))
    : Math.round(cfg.valeur);

  const plafond = cfg.plafondFcfa || 0;
  if (plafond > 0 && montant > plafond) montant = plafond;
  if (montant < 0) montant = 0;

  return {
    appliquee: montant > 0,
    libelle: cfg.libelle,
    mode: cfg.mode,
    valeur: cfg.valeur,
    baseTtcFcfa: base,
    montantFcfa: montant,
    motif: montant > 0 ? undefined : 'Montant calculé nul'
  };
}

/**
 * Applique (ou retire) la taxe additionnelle sur une facture.
 * Idempotent : la base TTC est mémorisée, le solde dû est ajusté du delta de taxe.
 */
export function applyTaxeAdditionnelleToInvoice(
  invoice: Invoice,
  config: TaxeAdditionnelleConfig | undefined
): Invoice {
  // Assiette : TTC hors taxe (mémorisé au 1er passage, sinon TTC courant).
  const baseTtc = Math.max(0, Number(invoice.montantTtcAvantTaxeFcfa ?? invoice.montantTtcFcfa) || 0);
  const ancienneTaxe = Number(invoice.taxeAdditionnelleFcfa) || 0;
  const ancienSolde = Number(invoice.soldeDuFcfa ?? baseTtc) || 0;

  const application = computeTaxeAdditionnelle(config, baseTtc, invoice.typeFacture);
  const nouveauTtc = baseTtc + application.montantFcfa;
  // Le solde dû suit la variation de la taxe (préserve les règlements déjà encaissés).
  const nouveauSolde = Math.max(0, ancienSolde - ancienneTaxe + application.montantFcfa);

  return {
    ...invoice,
    montantTtcAvantTaxeFcfa: baseTtc,
    taxeAdditionnelleFcfa: application.montantFcfa,
    taxeAdditionnelleLibelle: application.appliquee ? application.libelle : undefined,
    taxeAdditionnelleMode: application.appliquee ? application.mode : undefined,
    taxeAdditionnelleValeur: application.appliquee ? application.valeur : undefined,
    montantTtcFcfa: nouveauTtc,
    soldeDuFcfa: nouveauSolde
  };
}

/** Libellé lisible du mode, pour l'affichage écran / PDF. */
export function getTaxeAdditionnelleModeLabel(mode?: TaxeAdditionnelleMode): string {
  return mode === 'MONTANT_FIXE' ? 'Montant fixe' : 'Pourcentage du TTC';
}

/** Détail lisible de la valeur appliquée (ex. « 2 % du TTC » ou « 5 000 FCFA »). */
export function getTaxeAdditionnelleValeurLabel(
  mode?: TaxeAdditionnelleMode,
  valeur?: number
): string {
  const v = Number(valeur) || 0;
  return mode === 'MONTANT_FIXE'
    ? `${v.toLocaleString('fr-FR')} FCFA`
    : `${v.toLocaleString('fr-FR')} % du TTC`;
}