export type UserRole = 
  | 'ADMIN'
  | 'AGENT_IMPORT'
  | 'AGENT_EXPORT'
  | 'COMPTABILITE'
  | 'CLIENT_EXPORT';

export interface User {
  id: number;
  nomComplet: string;
  email: string;
  role: UserRole;
  telephone?: string;
  nomSociete?: string;
  pays?: string;
  estActif: boolean;
  motDePasse?: string;
  dateCreation?: string;
  dernierAcces?: string;
}

export interface Escale {
  id: number;
  nomNavire: string;
  callsign: string;
  numeroVoyage: string;
  portChargement: string;
  portDechargement: string;
  dateArrivee: string;
  dateAccostage?: string;
  dateDepart?: string;
  quai?: string;
  statut: 'EN_COURS' | 'CLOTUREE' | 'ANNULEE';
  createdBy?: string;
}

export type ContainerType = 
  | '20_DRY'
  | '40_DRY'
  | '40_HC'
  | '20_REEFER'
  | '40_REEFER'
  | '20_OPEN_TOP'
  | '40_OPEN_TOP'
  | '20_FLAT_RACK';

export interface Container {
  id: number;
  blId: number;
  numeroConteneur: string;
  typeConteneur: ContainerType;
  numeroScelle: string;
  poidsKg: number;
  poidsNetKg?: number;
  volumeM3?: number;
  tareKg: number;
  nombreColis: number;
  dateEntreeParc?: string;
  dateSortieParc?: string;
  montantCautionFcfa: number;
  statutLivraison?: 'AU_PARC' | 'LIVRE' | 'SURESTARIE';
  isDangerous?: boolean;
  imoClass?: string;
  unNumber?: string;
  flashPoint?: string;
  packingGroup?: string;
  socCoc?: 'SOC' | 'COC';
  // Computed fields
  joursSejour?: number;
  joursFranchise?: number;
  joursSurestarie?: number;
  montantSurestarieFcfa?: number;
  cautionRestitueeFcfa?: number;
}

export interface BL {
  id: number;
  escaleId: number;
  numeroBL: string;
  typeOperation: 'IMPORT' | 'EXPORT';
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
  nombreColis: number;
  typeEmballage: string;
  poidsBrutKg: number;
  volumeM3: number;
  statutImport?: 'EN_ATTENTE' | 'EN_COURS' | 'FACTURE';
  selectedInvoiceTypeIds?: string[];
  clientId?: number;
  codeNature?: string;
  uniqueCarrierRef?: string;
  marquesEtNumeros?: string;
  conteneurs: Container[];
  isDangerous?: boolean;
  imoClass?: string;
  unNumber?: string;
  flashPoint?: string;
  packingGroup?: string;
  cachetAgentAppose?: boolean;
  dateSignature?: string;
  hashSignature?: string;
}

export interface TarifSurestarie {
  id: number;
  typeConteneur: ContainerType;
  jourDebut: number;
  jourFin: number; // 999 for infinity
  tarifJournalierFcfa: number;
  regime?: 'SURESTARIE' | 'DETENTION';
  typeOperation?: 'IMPORT' | 'EXPORT';
  joursFranchise?: number;
}

export interface FranchiseSurestarie {
  id: number;
  typeConteneur: ContainerType;
  joursFranchise: number;
}

export type DraftStatus = 
  | 'BROUILLON' 
  | 'SOUMIS' 
  | 'VERROUILLE'
  | 'DEMANDE_CORRECTION'
  | 'CORRECTION_AUTORISEE'
  | 'EN_REVUE' 
  | 'DEMANDE_MODIF' 
  | 'VALIDE' 
  | 'REJETE'
  | 'BL_GENERE'
  | 'FACTURE';

export interface DemandeCorrectionDraft {
  motif: string;
  dateDemande: string;
  fraisAcceptes: boolean;
  montantFrais: number;
  statut: 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE';
  validePar?: string;
  dateValidation?: string;
  motifRefus?: string;
}

export interface DraftExport {
  id: number;
  clientId?: number;
  clientNom: string;
  clientSociete?: string;
  clientEmail?: string;
  escaleId?: number;
  numeroDraft: string;
  bookingRef?: string;
  navireNom?: string;
  numeroVoyage?: string;
  portChargementCode?: string;
  portDechargementCode?: string;
  portDechargementNom?: string;
  shipperInfo: {
    nom: string;
    adresse: string;
    pays: string;
    email?: string;
    phone?: string;
  };
  consigneeInfo: {
    nom: string;
    adresse: string;
    pays: string;
    email?: string;
    phone?: string;
  };
  notifyInfo: {
    nom: string;
    adresse: string;
    pays: string;
    email?: string;
    phone?: string;
  };
  marchandisesInfo: {
    description: string;
    poidsBrutKg: number;
    volumeM3: number;
    nombreColis: number;
    typeEmballage: string;
    hsCode?: string;
  };
  conteneursInfo: Array<{
    numeroConteneur: string;
    typeConteneur: ContainerType;
    numeroScelle: string;
    poidsKg: number;
    poidsNetKg: number;
    volumeM3: number;
    tareKg: number;
    nombreColis: number;
  }>;
  statut: DraftStatus;
  motifDemandeModification?: string;
  dateCreation: string;
  dateValidation?: string;
  numeroBlGenere?: string;
  // Règles spécifiques d'amendement & verrouillage ETA
  dateLimiteTransmission?: string; // 24h avant ETA
  estDeverrouille?: boolean;
  demandeCorrection?: DemandeCorrectionDraft;
  fraisAmendementFactures?: boolean;
  factureFraisId?: number;
}

export interface InvoiceItem {
  id?: number;
  designation: string;
  typeFrais: 'FRET' | 'ECHANGE' | 'TELEX' | 'TRANSFERT' | 'CAUTION' | 'DMDT_SURESTARIE' | 'AUTRE';
  quantite: number;
  prixUnitaireFcfa: number;
  montantHtFcfa: number;
  tauxTva: number;
}

export type InvoiceType = 'PROFORMA_IMPORT' | 'DEFINITIVE_IMPORT' | 'PROFORMA_EXPORT' | 'DEFINITIVE_EXPORT';
export type PaymentStatus = 'NON_PAYE' | 'PARTIEL' | 'PAYE';
export type InvoiceStatus = 'BROUILLON' | 'VALIDEE' | 'ANNULEE' | 'AVOIR';

export interface Invoice {
  id: number;
  blId?: number;
  numeroBL?: string;
  invoiceTypeId?: string;
  clientId?: number;
  clientNom: string;
  escaleInfo?: string;
  typeFacture: InvoiceType;
  numeroFacture: string;
  dateFacture: string;
  dateEcheance: string;
  devise: 'FCFA' | 'USD';
  tauxChangeUsd: number;
  montantHtFcfa: number;
  tvaFcfa: number;
  montantTtcFcfa: number;
  soldeDuFcfa: number;
  statutPaiement: PaymentStatus;
  statutFacture?: InvoiceStatus;
  motifAnnulation?: string;
  factureOrigineId?: number;
  avoirId?: number;
  createdBy?: string;
  validatedBy?: string;
  validatedAt?: string;
  cancelledAt?: string;
  fneReference?: string;
  fneStatut?: string;
  lignes: InvoiceItem[];
}

export interface CreditNoteItem {
  id?: number;
  creditNoteId?: number;
  designation: string;
  typeFrais: 'FRET' | 'ECHANGE' | 'TELEX' | 'TRANSFERT' | 'CAUTION' | 'DMDT_SURESTARIE' | 'AUTRE';
  quantite: number;
  prixUnitaireFcfa: number;
  montantHtFcfa: number;
  tauxTva: number;
}

export interface CreditNote {
  id: number;
  numeroAvoir: string;
  factureId: number;
  numeroFactureOrigine: string;
  clientNom: string;
  motif: string;
  dateEmission: string;
  montantHtFcfa: number;
  tvaFcfa: number;
  montantTtcFcfa: number;
  statut: 'VALIDE' | 'ANNULE';
  createdBy?: string;
  lignes: CreditNoteItem[];
}

export interface Payment {
  id: number;
  factureId: number;
  numeroFacture: string;
  datePaiement: string;
  modePaiement: 'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'MOBILE_MONEY';
  montantFcfa: number;
  referenceTransaction: string;
  note?: string;
  saisiPar: string;
}

export interface FneParam {
  id: number;
  cle: string;
  valeur: string;
  description: string;
  updatedAt: string;
}

export interface AuditLog {
  id: number;
  utilisateurNom: string;
  role: UserRole;
  action: string;
  entite: string;
  entiteId?: string | number;
  details: string;
  dateAction: string;
  ip: string;
}

export interface InvoiceTypeConfig {
  id: string;
  name: string;
  description: string;
}

export type FretCategory = 'CONTENEUR' | 'CONTENEUR_COC' | 'CONTENEUR_SOC' | 'VRAC' | 'RORO' | 'CONVENTIONNEL';

export type CalculationBase = 'BL' | 'CONTENEUR' | 'POIDS_TONNE' | 'TEU';

export interface PriceHistoryEntry {
  id: string;
  effectiveDate: string; // 'YYYY-MM-DD'
  amount: number;
  changedAt: string; // ISO string or formatted string
  changedBy?: string;
  note?: string;
}

export interface RubriqueConfig {
  id: string;
  invoiceTypeId: string;
  category: FretCategory;
  name: string;
  description: string;
  code: string;
  isActive: boolean;
  montantUnitaire: number;
  baseCalcul: CalculationBase;
  priceHistory?: PriceHistoryEntry[];
}
