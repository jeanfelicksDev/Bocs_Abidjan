import type { DraftExport } from '../types';

/**
 * Diff de contenu d'un draft export pendant la période de correction.
 *
 * Règles métier (affichage écran uniquement — le BL imprimé reste intact) :
 *  - Informations AJOUTÉES (ou modifiées) → rouge.
 *  - Informations restantes d'une partie concernée (suppressions / mixte) → vert.
 *  - Partie non modifiée → affichage normal.
 *
 * La base de comparaison est l'instantané `contenuOriginal` capturé au moment où
 * l'agent autorise la correction (déverrouillage), avant toute modification client.
 */

export type DraftFieldColor = 'AJOUTE' | 'CONSERVE' | 'NORMAL';

export interface DraftDiff {
  /** Au moins une partie du contenu a été modifiée. */
  hasAny: boolean;
  /** État par champ — clé « section.champ » (ex. « shipper.nom »). */
  fields: Record<string, DraftFieldColor>;
  /** État par numéro de conteneur. */
  conteneurs: Record<string, DraftFieldColor>;
  conteneursAjoutes: number;
  conteneursSupprimes: number;
}

/** Parties du draft comparées. « nav » = champs de niveau racine (navire, voyage, POD…). */
const SECTIONS: Array<{ key: string; fields: string[] }> = [
  { key: 'nav', fields: ['navireNom', 'numeroVoyage', 'portDechargementNom', 'portDechargementCode', 'bookingRef'] },
  { key: 'shipper', fields: ['nom', 'adresse', 'pays', 'email', 'phone'] },
  { key: 'consignee', fields: ['nom', 'adresse', 'pays', 'email', 'phone'] },
  { key: 'notify', fields: ['nom', 'adresse', 'pays', 'email', 'phone'] },
  { key: 'march', fields: ['description', 'poidsBrutKg', 'volumeM3', 'nombreColis', 'typeEmballage', 'hsCode'] }
];

function eq(a: unknown, b: unknown): boolean {
  const sa = a === null || a === undefined ? '' : String(a).trim();
  const sb = b === null || b === undefined ? '' : String(b).trim();
  return sa === sb;
}

function getSectionValue(obj: unknown, section: string, field: string): unknown {
  const o = obj as Record<string, unknown> | undefined;
  if (!o) return undefined;
  return section === 'nav' ? o[field] : (o[section] as Record<string, unknown> | undefined)?.[field];
}

/**
 * Instantané sérialisé du contenu métier d'un draft (hors statuts / métadonnées),
 * à capturer AVANT les modifications client — au moment du déverrouillage.
 */
export function snapshotContenuDraft(draft: DraftExport): string {
  return JSON.stringify({
    navireNom: draft.navireNom ?? null,
    numeroVoyage: draft.numeroVoyage ?? null,
    portDechargementNom: draft.portDechargementNom ?? null,
    portDechargementCode: draft.portDechargementCode ?? null,
    bookingRef: draft.bookingRef ?? null,
    shipperInfo: draft.shipperInfo,
    consigneeInfo: draft.consigneeInfo,
    notifyInfo: draft.notifyInfo,
    marchandisesInfo: draft.marchandisesInfo,
    conteneursInfo: draft.conteneursInfo || []
  });
}

/** Calcule le diff colorable d'un draft, ou null (pas d'instantané / illisible). */
export function getDraftDiff(draft: DraftExport): DraftDiff | null {
  if (!draft.contenuOriginal) return null;
  let original: Record<string, unknown>;
  try {
    original = JSON.parse(draft.contenuOriginal);
  } catch {
    return null;
  }

  const fields: Record<string, DraftFieldColor> = {};
  let hasAny = false;

  for (const sec of SECTIONS) {
    const changed: string[] = [];
    for (const f of sec.fields) {
      if (!eq(getSectionValue(original, sec.key, f), getSectionValue(draft, sec.key, f))) changed.push(f);
    }
    if (changed.length === 0) continue;
    hasAny = true;
    for (const f of sec.fields) {
      fields[`${sec.key}.${f}`] = changed.includes(f) ? 'AJOUTE' : 'CONSERVE';
    }
  }

  // Conteneurs : comparaison par numéro (identifiant métier)
  const origCtr = Array.isArray(original.conteneursInfo) ? (original.conteneursInfo as Array<Record<string, unknown>>) : [];
  const curCtr = Array.isArray(draft.conteneursInfo) ? draft.conteneursInfo : [];
  const origNums = new Set(origCtr.map(c => String(c.numeroConteneur ?? '')));
  const curNums = new Set(curCtr.map(c => String(c.numeroConteneur ?? '')));
  const ajoutes = curCtr.filter(c => !origNums.has(String(c.numeroConteneur ?? '')));
  const supprimes = origCtr.filter(c => !curNums.has(String(c.numeroConteneur ?? '')));

  const conteneurs: Record<string, DraftFieldColor> = {};
  if (ajoutes.length > 0 || supprimes.length > 0) {
    hasAny = true;
    for (const c of curCtr) {
      conteneurs[String(c.numeroConteneur ?? '')] = ajoutes.some(a => String(a.numeroConteneur ?? '') === String(c.numeroConteneur ?? '')) ? 'AJOUTE' : 'CONSERVE';
    }
  }

  return {
    hasAny,
    fields,
    conteneurs,
    conteneursAjoutes: ajoutes.length,
    conteneursSupprimes: supprimes.length
  };
}

/** État de coloration d'un champ (NORMAL si absent du diff). */
export function getDraftFieldColor(diff: DraftDiff | null, section: string, field: string): DraftFieldColor {
  return diff?.fields[`${section}.${field}`] || 'NORMAL';
}

/** Le diff est visible uniquement pendant la période de correction autorisée. */
export function isDraftEnPeriodeCorrection(draft: DraftExport): boolean {
  return Boolean(draft.estDeverrouille) || draft.statut === 'CORRECTION_AUTORISEE';
}
