import type { Container, FretCategory } from '../../types';

export type SourceFormat = 'MANIFESTE_BOCS' | 'BL_BIMCO';

/** Champ à faire contrôler par l'opérateur avant intégration. */
export interface ReviewFlag {
  field: string;
  message: string;
}

/** Connaissement tel que lu dans un document, avant rattachement à une escale. */
export interface ParsedBl {
  sourceFormat: SourceFormat;
  numeroBL: string;
  referenceNumero?: string;
  shipperNom: string;
  shipperAdresse: string;
  consigneeNom: string;
  consigneeAdresse: string;
  notifyNom: string;
  notifyAdresse: string;
  portChargementCode: string;
  portDechargementCode: string;
  destinationFinale: string;
  descriptionGoods: string;
  marquesEtNumeros: string;
  nombreColis: number;
  typeEmballage: string;
  /** Poids brut de la marchandise (hors tare des conteneurs), en kg. */
  poidsBrutKg: number;
  /** Total « Total BL » du manifeste quand il inclut la tare des conteneurs. */
  poidsTotalAvecTareKg?: number;
  volumeM3: number;
  typeMarchandise: FretCategory;
  conteneurs: Container[];
  nomNavire: string;
  numeroVoyage: string;
  dateEmbarquement?: string;
  bscNumero?: string;
  fdiNumero?: string;
  licenceNumero?: string;
  commandeNumero?: string;
  isDangerous?: boolean;
  unCode?: string;
  unNumber?: string;
  imoClass?: string;
  aVerifier: ReviewFlag[];
}

export function emptyParsedBl(sourceFormat: SourceFormat): ParsedBl {
  return {
    sourceFormat,
    numeroBL: '',
    shipperNom: '',
    shipperAdresse: '',
    consigneeNom: '',
    consigneeAdresse: '',
    notifyNom: '',
    notifyAdresse: '',
    portChargementCode: '',
    portDechargementCode: '',
    destinationFinale: '',
    descriptionGoods: '',
    marquesEtNumeros: '',
    nombreColis: 0,
    typeEmballage: '',
    poidsBrutKg: 0,
    volumeM3: 0,
    typeMarchandise: 'CONVENTIONNEL',
    conteneurs: [],
    nomNavire: '',
    numeroVoyage: '',
    aVerifier: [],
  };
}
