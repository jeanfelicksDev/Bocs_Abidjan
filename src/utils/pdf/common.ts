import type { Container } from '../../types';
import {
  countryCode,
  detectFretCategory,
  findBesc,
  findDangerous,
  isValidContainerNumber,
} from './layout.ts';
import type { ParsedBl } from './types.ts';

/** Lignes d'adresse → { nom, adresse } (1ʳᵉ ligne = raison sociale). */
export function splitParty(lines: string[]): { nom: string; adresse: string } {
  const clean = lines.map((l) => l.replace(/\s+/g, ' ').replace(/[,;]\s*$/, '').trim()).filter(Boolean);
  return { nom: (clean[0] || '').toUpperCase(), adresse: clean.slice(1).join(', ') };
}

/** Mentions de service et références (reprises dans leurs propres champs), hors désignation. */
const NOT_GOODS =
  /^(FREIGHT\s+(PRE)?PAID|FREIGHT\s+COLLECT|FRET\s+PAYABLE.*|(SHIPPED\s+)?ON\s+BOARD|A\s+BORD\s+LE.*|\(N\)\s*=.*|TARRA|(BESC|BSC|ECTN)\b.*)$/i;

export function goodsLines(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter((l) => l && !NOT_GOODS.test(l));
}

let containerSeq = 0;
export function newContainer(numero: string): Container {
  containerSeq += 1;
  return {
    id: Date.now() + containerSeq,
    blId: 0,
    numeroConteneur: numero,
    typeConteneur: '20_DRY',
    numeroScelle: '',
    poidsKg: 0,
    tareKg: 0,
    nombreColis: 0,
    montantCautionFcfa: 0,
    statutLivraison: 'AU_PARC',
  };
}

/**
 * Complète un BL lu : catégorie, références douanières, matières dangereuses,
 * destination, puis liste ce qui manque ou est incohérent. Ne remplit jamais
 * un champ par une valeur supposée.
 */
export function finalizeBl(bl: ParsedBl, descriptionAll: string, isOcr: boolean): ParsedBl {
  const flag = (field: string, message: string) => {
    if (!bl.aVerifier.some((f) => f.field === field)) bl.aVerifier.push({ field, message });
  };

  bl.typeMarchandise = detectFretCategory(descriptionAll, bl.conteneurs.length > 0);
  if (bl.typeMarchandise === 'CONTENEUR') {
    bl.typeEmballage = 'CTR';
    if (!bl.nombreColis) bl.nombreColis = bl.conteneurs.length;
  }

  bl.bscNumero = bl.bscNumero || findBesc(descriptionAll);
  const dg = findDangerous(descriptionAll);
  if (dg.isDangerous) {
    bl.isDangerous = true;
    bl.imoClass = dg.imoClass;
    bl.unCode = dg.unCode;
    bl.unNumber = dg.unCode ? `UN ${dg.unCode}` : undefined;
    for (const c of bl.conteneurs) {
      c.isDangerous = true;
      c.imoClass = dg.imoClass;
      c.unNumber = bl.unNumber;
    }
  }

  // Destination finale : transit explicite dans la désignation, sinon pays du port de déchargement.
  if (!bl.destinationFinale) {
    const transit = descriptionAll.match(/TRANSIT[^\n]*?(BURKINA\s*FASO|MALI|NIGER|GUIN[EÉ]E)/i);
    bl.destinationFinale = transit ? countryCode(transit[1]) : bl.portDechargementCode.startsWith('CI') ? 'CI' : '';
  }

  if (!bl.numeroBL) flag('numeroBL', 'Numéro de BL introuvable');
  if (!bl.shipperNom) flag('shipperNom', 'Expéditeur (shipper) non lu');
  if (!bl.consigneeNom) flag('consigneeNom', 'Destinataire (consignee) non lu');
  if (!bl.notifyNom) flag('notifyNom', 'Partie à notifier non lue');
  if (!bl.descriptionGoods) flag('descriptionGoods', 'Nature de la marchandise non lue');
  if (!bl.poidsBrutKg) flag('poidsBrutKg', 'Poids brut non lu');
  if (!bl.portChargementCode) flag('portChargementCode', 'Port de chargement non reconnu');
  if (!bl.portDechargementCode) flag('portDechargementCode', 'Port de déchargement non reconnu');

  bl.conteneurs.forEach((c) => {
    const ref = `conteneur ${c.numeroConteneur}`;
    if (!isValidContainerNumber(c.numeroConteneur)) flag(`conteneurs.${c.numeroConteneur}.numero`, `Clé de contrôle ISO invalide pour le ${ref}`);
    if (!c.numeroScelle) flag(`conteneurs.${c.numeroConteneur}.scelle`, `Plomb non lu pour le ${ref}`);
    if (!c.poidsKg) flag(`conteneurs.${c.numeroConteneur}.poids`, `Poids brut non lu pour le ${ref}`);
  });

  if (bl.conteneurs.length > 0) {
    const sum = bl.conteneurs.reduce((a, c) => a + (c.poidsKg || 0), 0);
    if (sum && bl.poidsBrutKg && Math.abs(sum - bl.poidsBrutKg) > 1) {
      flag('poidsBrutKg', `Somme des conteneurs (${round(sum)} kg) ≠ poids brut du BL (${round(bl.poidsBrutKg)} kg)`);
    }
    if (bl.poidsTotalAvecTareKg) {
      const tare = bl.conteneurs.reduce((a, c) => a + (c.tareKg || 0), 0);
      if (Math.abs(bl.poidsBrutKg + tare - bl.poidsTotalAvecTareKg) > 1) {
        flag('poidsBrutKg', `Total BL du manifeste (${round(bl.poidsTotalAvecTareKg)} kg) ≠ marchandise + tares (${round(bl.poidsBrutKg + tare)} kg)`);
      }
    }
  }

  if (isOcr) {
    flag('ocr', 'Document scanné lu par OCR : relire noms, adresses et chiffres');
  }
  return bl;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
