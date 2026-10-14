import type { BL, InvoiceTypeConfig } from '../types';

/**
 * Factures prévues par défaut pour un BL, selon son type de fret.
 * Règle unique, partagée par le compteur de l'accueil, la fenêtre de facturation
 * du BL, le module Facturation et le module Import :
 *   - Import conteneurs : Caution, Échange, Transfert (pas de Transfert si marchandise dangereuse)
 *   - Import vrac / roro / conventionnel : Échange
 *   - Export : Échange
 * Telex, Surestaries et Détentions ne sont jamais prévues d'office : elles dépendent
 * d'une demande ou d'un calcul propre au dossier.
 */

const lower = (s: string) => (s || '').toLowerCase();

export const isCautionType = (t: InvoiceTypeConfig) => lower(t.name).includes('caution');
export const isEchangeType = (t: InvoiceTypeConfig) =>
  t.id === '2' || lower(t.name).includes('echange') || lower(t.name).includes('échange');
export const isTransfertType = (t: InvoiceTypeConfig) => lower(t.name).includes('transfert');
const isOnDemandType = (t: InvoiceTypeConfig) => {
  const n = lower(t.name);
  return /telex|télex|surestarie|suréstarie|detention|détention/.test(n);
};

export function isContainerBl(bl: BL): boolean {
  if (bl.conteneurs && bl.conteneurs.length > 0) return true;
  const emballage = (bl.typeEmballage || '').toUpperCase();
  return emballage.includes('CONTENEUR') || emballage === 'CTR';
}

export function defaultInvoiceTypeIds(bl: BL, configs: InvoiceTypeConfig[]): string[] {
  const containerImport = bl.typeOperation !== 'EXPORT' && isContainerBl(bl);
  const dangerous = Boolean(bl.conteneurs?.some((c) => c.isDangerous));
  return configs
    .filter((t) => {
      if (isOnDemandType(t)) return false;
      if (isEchangeType(t)) return true;
      if (!containerImport) return false;
      if (isCautionType(t)) return true;
      if (isTransfertType(t)) return !dangerous;
      return false;
    })
    .map((t) => t.id);
}
